<script lang=ts>
import OpenCrypto from 'opencrypto';

    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { emailAddress, publicKey, privateKey, runUnderUserStore } from '../stores/user';
    import type { IUser, UserStore } from '../stores/user';
    import CreateUser from './CreateUser.svelte';

    let emailInput: HTMLInputElement;
    let feedback: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let createUserModalOpen : boolean;
    let creatingUser = writable(false);
    let loggingIn: boolean;

    onMount(() => emailInput.focus());

    const login = async () => {
        const error = (err: any) => {
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

        loggingIn = true;
        try {
            const existingUser = await runUnderUserStore(loginImplementation);
            if (existingUser) {
                $publicKey = existingUser.publicKey;

                const crypt = new OpenCrypto();
                
                try {
                    $privateKey = await crypt.decryptPrivateKey(
                        existingUser.encryptedPrivateKey,
                        password,
                        {
                            name:'RSA-OAEP',
                            hash:'SHA-512',
                            usages: [
                                'decrypt',
                                'unwrapKey'
                            ],
                            isExtractable:true
                        });
                } catch {
                    feedback = 'Unable to decrypt private key with this password';
                    passwordInvalid = true;
                }
            }
        } catch (e) {
            error(`Error: ${e && e.message || e}`);
            throw(e);
        } finally {
            loggingIn = false;
        }
    };

    async function loginImplementation(userStore: UserStore): Promise<IUser> {
        const lowercasedEmailAddress = $emailAddress.toLowerCase();
        const existingUser = await userStore.getUser(lowercasedEmailAddress);
        if (!existingUser) {
            feedback = 'User not found with this email. Did you mean to create a new user?';
            emailAddressInvalid = true;
        }
        return existingUser;
    }

    const onKeyPress = (e: KeyboardEvent) => e.key === 'Enter' && login();
    const createUser = () => createUserModalOpen = true;
    const closeUserCreation = () => $creatingUser || (createUserModalOpen = false);
</script>

<fieldset>
    <legend>&nbsp;Existing user&nbsp;</legend>
    <label for=email>Email:</label>
    <input type=email id=email bind:value={ $emailAddress } on:keypress={ onKeyPress }
           class:invalid={ emailAddressInvalid } disabled={ createUserModalOpen || loggingIn }
           bind:this={ emailInput } />
    <br />
    <label for=password>Password:</label>
    <input type=password id=password bind:value={ password } on:keypress={ onKeyPress }
           class:invalid={ passwordInvalid } disabled={ createUserModalOpen || loggingIn } />
    <br />
    <br />
    <input type=button value=Login on:click={ login } disabled={ createUserModalOpen || loggingIn } />
    { #if (feedback) }
        <br />
        <span />
        { feedback }
    { /if }
</fieldset>

<br />
<button on:click={ createUser }>Create new user</button>
<br />

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
        outline: #f00 auto 1px;
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
