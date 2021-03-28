<script lang=ts>
    import OpenCrypto from 'opencrypto';
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import {
        emailAddress, encryptionPrivateKey, encryptionPublicKey, signingPrivateKey, signingPublicKey, runUnderUserStore
    } from '../stores/user';
    import type { IUser, UserStore } from '../stores/user';
    import CreateUser from './CreateUser.svelte';
    import type { OrganizationsRequest, OrganizationsResponse } from '../modules/serverInterfaces';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import { sign } from '../modules/sign';
    import { organizations, runUnderOrganizationStore } from '../stores/organization';
    import type { IOrganization } from '../stores/organization';
    import onHashChanged from '../modules/onHashChanged';
    import { subscribePleaseWait } from '../stores/globalFeedback';
    import { api } from '../modules/api';

    let clazz: string;
    export { clazz as class };

    let emailInput: HTMLInputElement;
    let feedback: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let createUserModalOpen : boolean;
    let creatingUser = writable(false);
    const loggingIn = writable(false);

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

                const POST = 'POST';
                const url = `${getDefaultFunctionsUrl()}api/getorganizations`;
                const organizationsRequest = await sign<OrganizationsRequest>({
                    url,
                    method: POST,
                    body: {
                        emailAddress: $emailAddress as string
                    },
                    crypt,
                    signingKey: tempSigningPrivateKey
                });

                const organizationsResponse = await api<OrganizationsResponse>({
                    method: POST,
                    url,
                    body: organizationsRequest
                });
                let tempOrganizations: Array<IOrganization & { lowercasedEmailAddress: string }>;
                if (organizationsResponse.organizations?.length) {
                    let tempOrganizations = organizationsResponse.organizations.map(organization => {
                        if (!organization.name) {
                            throw new Error('Server returned organization without a name');
                        }
                        return {
                            lowercasedEmailAddress,
                            name: organization.name,
                            admin: organization.admin
                        };
                    });
                    await runUnderOrganizationStore(organizationStore => organizationStore.update(tempOrganizations));
                } else {
                    tempOrganizations = [];
                }

                $encryptionPrivateKey = tempEncryptionPrivateKey;
                $encryptionPublicKey = tempEncryptionPublicKey;
                $signingPrivateKey = tempSigningPrivateKey;
                $signingPublicKey = tempSigningPublicKey;
                $organizations = tempOrganizations;
            }
        } catch (e) {
            error(`Error: ${e && (e as { message: string }).message || e as string}`);
            throw (e);
        } finally {
            $loggingIn = false;
        }
    };
    const safeLogin = () => login().catch(console.error);

    async function loginImplementation(userStore: UserStore, lowercasedEmailAddress: string): Promise<IUser> {
        const existingUser = await userStore.getUser(lowercasedEmailAddress);
        if (!existingUser
            || !existingUser.lowercasedEmailAddress
            || !existingUser.encryptedEncryptionKey
            || !existingUser.encryptedSigningKey) {
            feedback = 'User not found with this email. Did you mean to create a new user?';
            emailAddressInvalid = true;
            return null;
        }
        return existingUser;
    }

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await login();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(console.error);
    const createUser = () => !$loggingIn && (createUserModalOpen = true);
    const closeUserCreation = () => $creatingUser as boolean || (createUserModalOpen = false);

    subscribePleaseWait(loggingIn, 'Logging in...');
</script>

<div class={ clazz }>
    <fieldset>
        <legend>&nbsp;Existing user&nbsp;</legend>
        <label for=email>Email:</label>
        <input type=email id=email bind:value={ $emailAddress } on:keypress={ safeOnKeyPress }
               class:invalid={ emailAddressInvalid } disabled={ createUserModalOpen || $loggingIn }
               bind:this={ emailInput } />
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
        background-color: #fff;
        color: #333;
    }

    input[ type=button ] {
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    span::before {
        content: "⚠";
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
