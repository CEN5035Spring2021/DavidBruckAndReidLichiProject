import OpenCrypto from 'opencrypto';
import { get } from 'svelte/store';
import { globalFeedback } from '../stores/globalFeedback';
import { organizations, organizationsSession, confirmingOrganization } from '../stores/organization';
import { emailAddress, encryptionPublicKey, signingPublicKey, usersSession } from '../stores/user';
import { api } from './api';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import getHashValue from './getHashValue';
import type { CreateOrganizationRequest, CreateOrganizationResponse } from './serverInterfaces';
import { CreateOrganizationResponseType } from './serverInterfaces';
import { sign } from './sign';

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
                const POST = 'POST';
                const url = `${getDefaultFunctionsUrl()}api/createorganization`;
                const createOrganizationRequest = await sign<CreateOrganizationRequest>({
                    url,
                    method: POST,
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

                const response = await api<CreateOrganizationResponse>({
                    method: POST,
                    url,
                    body: createOrganizationRequest
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
                        globalFeedback.update(feedback =>
                            [
                                ...feedback,
                                {
                                    message: `Organization confirmed: ${response.name}`,
                                    isInformational: true,
                                    title: 'Email address verified'
                                }
                            ]);
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
