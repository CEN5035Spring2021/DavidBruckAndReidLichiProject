import OpenCrypto from 'opencrypto';
import { get } from 'svelte/store';
import { globalFeedback } from '../stores/globalFeedback';
import { selectedGroup } from '../stores/group';
import {
    confirmingOrganization, runUnderOrganizationStore, selectedOrganization, switchingOrganization
} from '../stores/organization';
import {
    emailAddress, encryptionPublicKey, signingPublicKey, groupUserConfirmationEmailAddress, signingPrivateKey
} from '../stores/user';
import { api } from './api';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import getHashValue from './getHashValue';
import type {
    CreateGroupUserRequest, CreateGroupUserResponse, CreateOrganizationRequest, CreateOrganizationResponse
} from './serverInterfaces';
import { CreateOrganizationResponseType, CreateGroupUserResponseType } from './serverInterfaces';
import { sign } from './sign';

const POST = 'POST';

export default async function onHashChanged(
    options?: {
        crypt?: OpenCrypto;
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
        tempSigningPrivateKey?: CryptoKey;
    } | Partial<HashChangeEvent>) : Promise<void> {

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
            tempSigningPrivateKey = get(signingPrivateKey), crypt = new OpenCrypto()
        } = options;

        if (await organizationConfirmation({
            tempEncryptionPublicKey,
            tempSigningPrivateKey,
            tempSigningPublicKey,
            crypt
        })) {
            return;
        }

        await groupUserConfirmation({
            tempEncryptionPublicKey,
            tempSigningPublicKey,
            tempSigningPrivateKey,
            crypt
        });
    } catch (e) {
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: `Error in onHashChanged: ${e && (e as { message: string }).message || e as string}`
            }
        ]);
    }
}

async function organizationConfirmation(
    { tempEncryptionPublicKey, tempSigningPrivateKey, tempSigningPublicKey, crypt }: {
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPrivateKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
        crypt: OpenCrypto;
    }) : Promise<boolean> {
    if (!tempEncryptionPublicKey || !tempSigningPrivateKey || !tempEncryptionPublicKey) {
        // User must be logged-in to verify email
        return;
    }

    const confirmation = getHashValue('organizationConfirmation');

    if (!confirmation) {
        return false;
    }

    confirmingOrganization.set(true);

    try {
        const url = `${getDefaultFunctionsUrl()}api/createorganization`;
        const localEmailAddress = get(emailAddress);
        const encryptionPublicKey = await crypt.cryptoPublicToPem(tempEncryptionPublicKey) as string;
        const createOrganizationRequest = await sign<CreateOrganizationRequest>({
            url,
            method: POST,
            body: {
                confirmation,
                emailAddress: localEmailAddress,
                encryptionKey: encryptionPublicKey,
                signingKey: await crypt.cryptoPublicToPem(tempSigningPublicKey) as string
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
                await runUnderOrganizationStore(organizationStore => organizationStore.append({
                    name: response.name,
                    users: [
                        {
                            emailAddress: localEmailAddress,
                            encryptionPublicKey
                        }
                    ],
                    admin: true
                }));
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

    location.hash = '';

    return true;
}

async function groupUserConfirmation(
    { tempEncryptionPublicKey, tempSigningPublicKey, tempSigningPrivateKey, crypt } : {
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
        tempSigningPrivateKey?: CryptoKey;
        crypt: OpenCrypto;
    }) : Promise<void> {
    const confirmation = getHashValue('groupUserConfirmation');

    if (!confirmation) {
        return;
    }

    let hashEmailAddress = getHashValue('emailAddress');
    if (!hashEmailAddress) {
        throw new Error('Hash parameter missing for emailAddress');
    }

    hashEmailAddress = decodeURIComponent(hashEmailAddress);

    if (!tempEncryptionPublicKey || !tempSigningPublicKey || !tempSigningPrivateKey) {
        groupUserConfirmationEmailAddress.set(hashEmailAddress);
        return;
    }

    if (hashEmailAddress.toLowerCase() !== get(emailAddress).toLowerCase()) {
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: `Group user confirmation link is for a different user: ${hashEmailAddress}`,
                title: 'Unable to process confirmation link'
            }
        ]);
        return;
    }

    const url = `${getDefaultFunctionsUrl()}api/creategroupuser`;
    const createGroupRequest = await sign<CreateGroupUserRequest>({
        url,
        method: POST,
        body: {
            emailAddress: hashEmailAddress,
            confirmation,
            encryptionKey: await crypt.cryptoPublicToPem(tempEncryptionPublicKey) as string,
            signingKey: await crypt.cryptoPublicToPem(tempSigningPublicKey) as string
        },
        crypt,
        signingKey: tempSigningPrivateKey
    });

    const response = await api<CreateGroupUserResponse>({
        method: POST,
        url,
        body: createGroupRequest
    });
    switch (response.type) {
        case CreateGroupUserResponseType.Created: {
            if (response.organization) {
                const usersToEncryptionKey = response.users && new Map<string, string>(
                    response.users.map(user => {
                        if (!user || !user.emailAddress) {
                            throw new Error('Server returned a user without an email address');
                        }
                        if (!user.encryptionPublicKey) {
                            throw new Error('Server returned a user without an encryption key');
                        }
                        return [ user.emailAddress, user.encryptionPublicKey ];
                    }));

                if (!response.organization || !response.organization.name) {
                    throw new Error('Server returned an organization without a name');
                }

                const tempOrganization = {
                    name: response.organization.name,
                    admin: response.organization.admin,
                    users: [ ...usersToEncryptionKey.entries() ].map(
                        ([ emailAddress, encryptionPublicKey ]) => ({
                            emailAddress,
                            encryptionPublicKey
                        })
                    ),
                    groups: response.organization.groups?.map(
                        organizationGroup => {
                            if (!organizationGroup || !organizationGroup.name) {
                                throw new Error('Server returned an organization group without a name');
                            }
                            return {
                                name: organizationGroup.name,
                                users: organizationGroup.users?.map(
                                    emailAddress => {
                                        if (!emailAddress) {
                                            throw new Error(
                                                'Server returned an organization group user without an email ' +
                                                'address');
                                        }
                                        const encryptionPublicKey = usersToEncryptionKey.get(emailAddress);
                                        if (!encryptionPublicKey) {
                                            throw new Error(
                                                'Server returned an organization group user without an ' +
                                                'encryption key');
                                        }
                                        return {
                                            emailAddress,
                                            encryptionPublicKey
                                        };
                                    })
                            };
                        })
                };
                globalFeedback.update(feedback =>
                    [
                        ...feedback,
                        {
                            message: 'User added to group',
                            isInformational: true,
                            title: 'Email address verified'
                        }
                    ]);
                switchingOrganization.set(true);

                const addedGroups = await runUnderOrganizationStore(organizationStore => organizationStore.update({
                    lowercasedEmailAddress: hashEmailAddress.toLowerCase(),
                    organizations: [
                        tempOrganization
                    ]
                }));
                if (get(selectedOrganization) === tempOrganization.name) {
                    switchingOrganization.set(false);
                } else {
                    selectedOrganization.set(tempOrganization.name);
                }

                selectedGroup.set(addedGroups?.length ? addedGroups[0] : null);
            }
            break;
        }
        case CreateGroupUserResponseType.AlreadyExists:
            globalFeedback.update(feedback => [
                ...feedback,
                {
                    message: 'User already part of group'
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

    groupUserConfirmationEmailAddress.set('');

    location.hash = '';
}

function isHashChangeEvent(
    options?: {
        crypt?: OpenCrypto;
        tempEncryptionPublicKey?: CryptoKey;
        tempSigningPublicKey?: CryptoKey;
    } | Partial<HashChangeEvent>): options is Partial<HashChangeEvent> {

    return options && typeof (options as Partial<HashChangeEvent>).newURL === 'string';
}
