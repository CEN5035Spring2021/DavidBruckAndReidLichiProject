import { HubConnectionBuilder } from '@microsoft/signalr';
import { unconditionalMessage, showUnconditionalMessage, globalFeedback } from '../stores/globalFeedback';
import { runUnderOrganizationStore } from '../stores/organization';
import { api } from './api';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import type { NewGroupUserMessage, SignalRConnectionInfo } from './serverInterfaces';

const GET = 'GET';

export async function connectSignalR(xMsClientPrincipalName: string) : Promise<void> {
    let firstConnectionInfo = await getSignalRConnectionInfo(xMsClientPrincipalName);
    const hubConnection = new HubConnectionBuilder()
        .withUrl(
            firstConnectionInfo.url,
            {
                accessTokenFactory: async() => {
                    if (firstConnectionInfo) {
                        const accessToken = firstConnectionInfo.accessToken;
                        firstConnectionInfo = null;
                        return accessToken;
                    }
                    return (await getSignalRConnectionInfo(xMsClientPrincipalName)).accessToken;
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

function getSignalRConnectionInfo(xMsClientPrincipalName: string) : Promise<SignalRConnectionInfo> {
    const url = `${getDefaultFunctionsUrl()}api/negotiate`;
    return api<SignalRConnectionInfo>({
        method: GET,
        url,
        xMsClientPrincipalName
    });
}
