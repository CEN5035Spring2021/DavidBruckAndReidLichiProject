import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import type OpenCrypto from 'opencrypto';
import type { IGlobalFeedback } from '../stores/globalFeedback';
import { unconditionalMessage, showUnconditionalMessage, globalFeedback } from '../stores/globalFeedback';
import { runUnderOrganizationStore } from '../stores/organization';
import { api } from './api';
import fetchMessages from './fetchMessages';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import type { NegotiateRequest, NewGroupUserMessage, NegotiateResponse } from './serverInterfaces';
import { NegotiateResponseType } from './serverInterfaces';
import { sign } from './sign';

const GET = 'GET';
const POST = 'POST';
const NOT_FOUND = -1;
const LENGTH_OF_ALPHANUMERIC = 36;
const STRING_START = 0;

export async function connectSignalR(
    options: {
        xMsClientPrincipalName: string;
        crypt?: OpenCrypto;
        signingPrivateKey?: CryptoKey;
    }) : Promise<void> {
    const signalRResponse = await getSignalRConnectionInfo(options);
    if (signalRResponse.type !== NegotiateResponseType.Success) {
        return;
    }

    let firstConnectionInfo = signalRResponse.connectionInfo;

    const hubConnection = new HubConnectionBuilder()
        .configureLogging(LogLevel.Error)
        .withUrl(
            firstConnectionInfo.url,
            {
                accessTokenFactory: async() => {
                    if (firstConnectionInfo) {
                        const accessToken = firstConnectionInfo.accessToken;
                        firstConnectionInfo = null;
                        return accessToken;
                    }
                    const newSignalRResponse = await getSignalRConnectionInfo(options);
                    if (signalRResponse.type !== NegotiateResponseType.Success) {
                        return;
                    }

                    return newSignalRResponse.connectionInfo.accessToken;
                }
            })
        .build();

    hubConnection.onclose(err => {
        if (err) {
            unconditionalMessage.set({
                message: `SignalR HubConnection closed with error: ${err && err.message || (err as unknown as string)}`
            });
            showUnconditionalMessage.set(true);
        }
    });

    hubConnection.on('newGroupUser', onNewGroupUser);
    hubConnection.on('newMessage', onNewMessage);

    await hubConnection.start();
}

function onNewGroupUser(message: NewGroupUserMessage) : void {
    runUnderOrganizationStore(store => store.appendGroupUser({
        user: {
            emailAddress: message.emailAddress,
            encryptionPublicKey: message.encryptionKey
        },
        organization: message.organization,
        group: message.group
    })).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in onNewGroupUser: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));
}
function onNewMessage() : void {
    fetchMessages({}).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in onNewMessage: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));
}

async function getSignalRConnectionInfo(
    { xMsClientPrincipalName, crypt, signingPrivateKey } : {
        xMsClientPrincipalName: string;
        crypt?: OpenCrypto;
        signingPrivateKey?: CryptoKey;
    }) : Promise<NegotiateResponse> {
    const url = `${getDefaultFunctionsUrl()}api/negotiate`;
    const method = signingPrivateKey ? POST : GET;
    let body: NegotiateRequest;
    const response = await api<NegotiateResponse>(
        signingPrivateKey
            ? {
                method,
                url,
                body: await sign({
                    method,
                    url,
                    body: body = {
                        emailAddress: xMsClientPrincipalName
                    },
                    crypt,
                    signingKey: signingPrivateKey,
                    omitBody: true
                }),
                xMsClientPrincipalName
            }
            : {
                method,
                url,
                xMsClientPrincipalName
            });
    switch (response.type) {
        case NegotiateResponseType.Success:
            break;
        case NegotiateResponseType.UserAlreadyExists: {
            const userAlreadyExistsFeedback: IGlobalFeedback = {
                message: 'Another user already confirmed this email address. Create a new user.'
            };
            globalFeedback.update(feedback =>
                [
                    ...feedback,
                    userAlreadyExistsFeedback
                ]);
            globalFeedback.subscribe(value => {
                if (value.indexOf(userAlreadyExistsFeedback) === NOT_FOUND) {
                    if (location.hash) {
                        location.href = location.href.split('#')[0];
                    } else {
                        location.reload();
                    }
                }
            });
            break;
        }
        default: {
            const unexpectedTypeFeedback: IGlobalFeedback = {
                message: `Unexpected server response type ${response.type as string}`
            };
            globalFeedback.update(feedback =>
                [
                    ...feedback,
                    unexpectedTypeFeedback
                ]);
            globalFeedback.subscribe(value => {
                if (value.indexOf(unexpectedTypeFeedback) === NOT_FOUND) {
                    if (location.hash) {
                        location.href = location.href.split('#')[0];
                    } else {
                        location.reload();
                    }
                }
            });
            break;
        }
    }
    return response;
}

const safeCharCodes = new Set<number>(
    [ ...Array(LENGTH_OF_ALPHANUMERIC).keys() ] // 0-9 and a-z
        .map(idx => idx.toString(LENGTH_OF_ALPHANUMERIC).charCodeAt(STRING_START))
        .concat(
            [ '-', '.', '_' ].map(
                safeChar => safeChar.charCodeAt(STRING_START))
        ));

// Need to encode SignalR user names to prevent errors which only occur on Azure.
// Oddly, the emulator had no such issues. Example problematic email: dbruck1+Admin@fau.edu
// Error from Azure:
// Microsoft.Azure.SignalR.Common.AzureSignalRUnauthorizedException : Authorization failed.
// Make sure you provide the correct connection string and have access to the resource. Request Uri:
export function encodeMsClientPrincipalName(xMsClientPrincipalName: string) : string {
    return [ ...Array(xMsClientPrincipalName.length).keys() ].reduce(
        (previousValue, currentValue) => {
            const nextCharCode = xMsClientPrincipalName.charCodeAt(currentValue);
            return safeCharCodes.has(nextCharCode)
                ? previousValue + xMsClientPrincipalName[currentValue]
                : previousValue + escapeCharCode(nextCharCode);
        },
        '');
}

function escapeCharCode(charCode: number) : string {
    return `~${charCode}~`;
}
