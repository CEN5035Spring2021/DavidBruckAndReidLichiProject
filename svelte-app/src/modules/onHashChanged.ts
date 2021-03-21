import OpenCrypto from 'opencrypto';
import { get } from 'svelte/store';
import { globalFeedback } from '../stores/globalFeedback';
import { organizations, organizationsSession, confirmingOrganization } from '../stores/organization';
import { emailAddress, encryptionPublicKey, signingPublicKey, usersSession } from '../stores/user';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import getHashValue from './getHashValue';
import type { CreateOrganizationRequest, CreateOrganizationResponse } from './serverInterfaces';
import { CreateOrganizationResponseType } from './serverInterfaces';
import { sign } from './sign';

const READY = 4; // XHR Ready
const OK = 200; // HTTP status

export default async function onHashChanged(
    options?: {
        crypt?: OpenCrypto;
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
        tempSigningPrivateKey?: CryptoKey;
    } | HashChangeEvent) : Promise<void> {

    try {
        if (isHashChangeEvent(options)) {
            // Window.onhashcode calls this function without waiting, so promise failures must be handled here
            onHashChanged({}).catch(reason =>
                globalFeedback.update(feedback => [
                    ...feedback,
                    {
                        message: 'Error in onHashChanged: ' +
                            (reason && (reason as { message: string }).message || reason as string)
                    }
                ]));
            return;
        }
        const {
            tempEncryptionPublicKey = get(encryptionPublicKey), tempSigningPublicKey = get(signingPublicKey),
            tempSigningPrivateKey = null, crypt = new OpenCrypto()
        } = options;

        if (!tempEncryptionPublicKey) {
            // User must be logged-in to verify email
            return;
        }

        const confirmation = getHashValue('organizationConfirmation');

        if (confirmation) {
            confirmingOrganization.set(true);

            try {
                const createOrganizationRequest = await sign<CreateOrganizationRequest>({
                    body: {
                        confirmation,
                        emailAddress: get(emailAddress),
                        encryptionKey: await crypt.cryptoPublicToPem(tempEncryptionPublicKey) as string,
                        signingKey: await crypt.cryptoPublicToPem(tempSigningPublicKey) as string,
                        usersSession: get(usersSession) || undefined,
                        organizationsSession: get(organizationsSession) || undefined
                    },
                    crypt,
                    signingKey: tempSigningPrivateKey
                });

                const response = await new Promise<CreateOrganizationResponse>(
                    (resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.onreadystatechange = function() {
                            if (this.readyState !== READY) {
                                return;
                            }

                            if (this.status === OK) {
                                resolve(JSON.parse(this.responseText));
                            } else {
                                reject(`Server error ${this.status} ${this.responseText}`);
                            }
                        };
                        xhr.open('POST', `${getDefaultFunctionsUrl()}api/createorganization`);
                        xhr.send(JSON.stringify(createOrganizationRequest));
                    });
                switch (response.type) {
                    case CreateOrganizationResponseType.Created:
                        organizations.update(existingOrganizations => [
                            ...existingOrganizations,
                            {
                                name: response.name,
                                admin: true
                            }
                        ]);
                        console.log(JSON.stringify(response));
                        usersSession.set(response.usersSession);
                        organizationsSession.set(response.organizationsSession);
                        break;
                    case CreateOrganizationResponseType.AlreadyExists:
                        globalFeedback.update(feedback => [
                            ...feedback,
                            {
                                message: 'Organization already exists'
                            }
                        ]);
                        break;
                    default:
                        globalFeedback.update(feedback =>
                            [
                                ...feedback,
                                {
                                    message: `Unexpected server response type ${response.type}`
                                }
                            ]);
                        break;
                }
            } finally {
                confirmingOrganization.set(false);
            }
        }

        location.hash = '';
    } catch (e) {
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: `Error in onHashChanged: ${e && (e as { message: string }).message || e as string}`
            }
        ]);
    }
}

function isHashChangeEvent(
    options?: {
        crypt?: OpenCrypto;
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
    } | HashChangeEvent): options is HashChangeEvent {

    return options && typeof (options as HashChangeEvent).newURL === 'string';
}
