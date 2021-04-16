<script lang=ts>
    import OpenCrypto from 'opencrypto';
    import { onDestroy, onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import {
        emailAddress, encryptionPrivateKey, encryptionPublicKey, signingPrivateKey, signingPublicKey, runUnderUserStore,
        groupUserConfirmationEmailAddress
    } from '../stores/user';
    import type { IUser, UserStore } from '../stores/user';
    import CreateUser from './CreateUser.svelte';
    import type { OrganizationsRequest, OrganizationsResponse } from '../modules/serverInterfaces';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import { sign } from '../modules/sign';
    import { runUnderOrganizationStore } from '../stores/organization';
    import type { IOrganization } from '../stores/organization';
    import onHashChanged from '../modules/onHashChanged';
    import { globalFeedback, subscribePleaseWait } from '../stores/globalFeedback';
    import { api } from '../modules/api';
    import { connectSignalR } from '../modules/signalR';
    import fetchMessages from '../modules/fetchMessages';

    let clazz: string;
    export { clazz as class };

    const POST = 'POST';

    let emailInput: HTMLInputElement;
    let feedback: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let createUserModalOpen : boolean;
    const creatingUser = writable(false);
    const loggingIn = writable(false);

    const groupUserConfirmationEmailAddressSubscription =
        groupUserConfirmationEmailAddress.subscribe(value => {
            if (!value || $loggingIn) {
                return;
            }

            $emailAddress = $groupUserConfirmationEmailAddress as string;
        });

    onMount(() => emailInput.focus());

    const login = async() =>{
        const error = (err: string) => {
            if (!feedback) {
                feedback = err;
            }
        };

        feedback = '';
        emailAddressInvalid = false;
        passwordInvalid = false;

        if (!$emailAddress) {
            error('Email is required');
            emailAddressInvalid = true;
        }

        if (!password) {
            error('Password is required');
            passwordInvalid = true;
        }

        if (feedback) {
            return;
        }

        $loggingIn = true;
        try {
            const lowercasedEmailAddress = ($emailAddress as string).toLowerCase();
            const existingUser = await runUnderUserStore(loginImplementation, lowercasedEmailAddress);
            if (existingUser) {
                const crypt = new OpenCrypto();

                let tempEncryptionPrivateKey: CryptoKey;
                let tempEncryptionPublicKey: CryptoKey;
                let tempSigningPrivateKey: CryptoKey;
                let tempSigningPublicKey: CryptoKey;
                try {
                    tempEncryptionPrivateKey = await crypt.decryptPrivateKey(
                        existingUser.encryptedEncryptionKey,
                        password,
                        {
                            name: 'RSA-OAEP',
                            hash: 'SHA-512',
                            usages: [
                                'decrypt',
                                'unwrapKey'
                            ],
                            isExtractable: true
                        }) as CryptoKey;
                    tempEncryptionPublicKey = await crypt.getPublicKey(
                        tempEncryptionPrivateKey,
                        {
                            name: 'RSA-OAEP',
                            hash: {
                                name: 'SHA-512'
                            },
                            usages: [
                                'encrypt'
                            ],
                            isExtractable: true
                        }) as CryptoKey;

                    tempSigningPrivateKey = await crypt.decryptPrivateKey(
                        existingUser.encryptedSigningKey,
                        password,
                        {
                            name: 'RSASSA-PKCS1-v1_5',
                            hash: 'SHA-512',
                            usages: [
                                'sign'
                            ],
                            isExtractable: true
                        }) as CryptoKey;
                    tempSigningPublicKey = await crypt.getPublicKey(
                        tempSigningPrivateKey,
                        {
                            name: 'RSASSA-PKCS1-v1_5',
                            hash: {
                                name: 'SHA-512'
                            },
                            usages: [
                                'verify'
                            ],
                            isExtractable: true
                        }) as CryptoKey;
                } catch {
                    feedback = 'Unable to decrypt private key with this password';
                    passwordInvalid = true;
                }

                if (feedback) {
                    return;
                }

                // Hash hasn't changed, but this is the earliest we can process it
                await onHashChanged({
                    crypt,
                    tempEncryptionPublicKey,
                    tempSigningPublicKey,
                    tempSigningPrivateKey
                });

                const url = `${getDefaultFunctionsUrl()}api/getorganizations`;
                const organizationsRequest = await sign<OrganizationsRequest>({
                    url,
                    method: POST,
                    body: {
                        emailAddress: existingUser.emailAddress
                    },
                    crypt,
                    signingKey: tempSigningPrivateKey
                });

                const organizationsResponse = await api<OrganizationsResponse>({
                    method: POST,
                    url,
                    body: organizationsRequest
                });
                const usersToEncryptionKey = organizationsResponse.users && new Map<string, string>(
                    organizationsResponse.users.map(user => {
                        if (!user || !user.emailAddress) {
                            throw new Error('Server returned a user without an email address');
                        }
                        if (!user.encryptionPublicKey) {
                            throw new Error('Server returned a user without an encryption key');
                        }
                        return [ user.emailAddress, user.encryptionPublicKey ];
                    }));
                let tempOrganizations: IOrganization[];
                if (organizationsResponse.organizations?.length) {
                    tempOrganizations = organizationsResponse.organizations.map<IOrganization>(organization => {
                        if (!organization || !organization.name) {
                            throw new Error('Server returned an organization without a name');
                        }
                        return {
                            name: organization.name,
                            admin: organization.admin,
                            users: organization.users?.map(
                                emailAddress => {
                                    if (!emailAddress) {
                                        throw new Error('Server returned an organization user without an email address');
                                    }
                                    const encryptionPublicKey = usersToEncryptionKey.get(emailAddress);
                                    if (!encryptionPublicKey) {
                                        throw new Error('Server returned an organization user without an encryption key');
                                    }
                                    return {
                                        emailAddress,
                                        encryptionPublicKey
                                    };
                                }),
                            groups: organization.groups?.map(
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
                    });
                    await runUnderOrganizationStore(organizationStore => organizationStore.update({
                        lowercasedEmailAddress,
                        organizations: tempOrganizations
                    }));
                } else {
                    tempOrganizations = [];
                }

                $emailAddress = existingUser.emailAddress; // In case the email address had different casing

                await connectSignalR(existingUser.emailAddress);
                if (tempOrganizations.length) {
                    await fetchMessages({
                        signingPrivateKey: tempSigningPrivateKey
                    });
                }

                $encryptionPrivateKey = tempEncryptionPrivateKey;
                $encryptionPublicKey = tempEncryptionPublicKey;
                $signingPrivateKey = tempSigningPrivateKey;
                $signingPublicKey = tempSigningPublicKey;
            }
        } catch (e) {
            error(`Error: ${e && (e as { message: string }).message || e as string}`);
            throw (e);
        } finally {
            $loggingIn = false;

            if ($groupUserConfirmationEmailAddress && !$encryptionPublicKey) {
                $emailAddress = $groupUserConfirmationEmailAddress as string;
            }
        }
    };
    const safeLogin = () => login().catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeLogin: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    async function loginImplementation(userStore: UserStore, lowercasedEmailAddress: string): Promise<IUser> {
        const existingUser = await userStore.getUser(lowercasedEmailAddress);
        if (!existingUser
            || !existingUser.lowercasedEmailAddress
            || !existingUser.encryptedEncryptionKey
            || !existingUser.encryptedSigningKey
            || !existingUser.emailAddress) {
            feedback = 'User not found with this email. Did you mean to create a new user?';
            emailAddressInvalid = true;
            return null;
        }
        return existingUser;
    }

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await login();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeOnKeyPress: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));
    const createUser = () => !$loggingIn && (createUserModalOpen = true);
    const closeUserCreation = () => $creatingUser as boolean || (createUserModalOpen = false);

    const pleaseWaitSubscription = subscribePleaseWait(loggingIn, 'Logging in...');
    onDestroy(() => {
        groupUserConfirmationEmailAddressSubscription();
        pleaseWaitSubscription();
    });
</script>

<div class={ clazz }>
    <fieldset>
        <legend>&nbsp;Existing user&nbsp;</legend>
        <label for=email>Email:</label>
        <input type=email id=email bind:value={ $emailAddress } on:keypress={ safeOnKeyPress }
               class:invalid={ emailAddressInvalid } bind:this={ emailInput }
               disabled={ createUserModalOpen || $loggingIn || !!$groupUserConfirmationEmailAddress } />
        <br />
        <label for=password>Password:</label>
        <input type=password id=password bind:value={ password } on:keypress={ safeOnKeyPress }
               class:invalid={ passwordInvalid } disabled={ createUserModalOpen || $loggingIn } />
        <br />
        <br />
        <input type=button value=Login disabled={ createUserModalOpen || $loggingIn } on:click={ safeLogin } />
        { #if (feedback) }
            <br />
            <span />
            { feedback }
        { /if }
    </fieldset>

    <br />
    <button on:click={ createUser }>Create new user</button>
    <br />
</div>

{ #if (createUserModalOpen) }
    <CreateUser close={ closeUserCreation } { creatingUser } />
{ /if }

<style>
    legend {
        font-size: 1.3em;
        font-weight: 700;
    }

    label {
        font-weight: 600;
    }

    input {
        width: 100%;
    }
        input:not(:disabled) {
            background-color: #fff;
            color: #333;
        }

    input[ type=button ] {
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    span::before {
        content: "\26A0";
        font-size: 1.5em;
        font-weight: 700;
        color: #ff8c00;
        vertical-align: sub;
    }

    .invalid {
        outline: #f00 solid 1px;
    }

    button {
        color: #0064c8;
        cursor: pointer;
        background: none;
        padding: 0;
        margin: 0;
        border: none;
    }

    button:hover {
        text-decoration: underline;
    }

    @media (min-width: 640px) {
        fieldset {
            width: 80%;
            margin-left: auto;
            margin-right: auto;
        }

        label {
            float: left;
            width: calc(25% - 0.5em);
            text-align: right;
            margin-top: 0.3em;
        }

        input {
            width: 75%;
        }

        input[ type=button ] {
            margin-left: calc(25% - 12px);
        }
    }
</style>
