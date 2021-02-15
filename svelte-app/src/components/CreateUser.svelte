<script lang=ts>
    import { onMount } from 'svelte';
    import { emailAddress, publicKey, privateKey, runUnderUserStore } from '../stores/user';
    import type { UserStore, IUser } from '../stores/user';
    import Modal from './Modal.svelte';
    import OpenCrypto from 'opencrypto';
    import type { Writable } from 'svelte/store';

    export let close: () => void;
    export let creatingUser: Writable<boolean>;

    let emailInput: HTMLInputElement;
    let feedback: string;
    let localEmailAddress: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let confirmPassword: string;
    let confirmPasswordInvalid: boolean;

    onMount(() => emailInput.focus());

    const createUser = async () => {
        const error = (err: any) => {
            if (!feedback) {
                feedback = err;
            }
        };

        feedback = '';
        emailAddressInvalid = false;
        passwordInvalid = false;

        if (!localEmailAddress) {
            error('Email is required');
            emailAddressInvalid = true;
        }
        
        if (!password) {
            error('Password is required');
            passwordInvalid = true;
        }
        
        if (!confirmPassword) {
            error('Confirm password is required');
            confirmPasswordInvalid = true;
        }

        if (password !== confirmPassword) {
            error('Confirm password does not match');
            confirmPasswordInvalid = true;
        }

        if (feedback) {
            return;
        }

        $creatingUser = true;
        try {
            // While it seems like it would be more efficient to skip creating the public/private key pair
            // if we end up finding a duplicate user with the same email address, that would cause error:
            // !! Failed to execute 'put' on 'IDBObjectStore': The transaction has finished
            //
            // This is because on the onsuccess callback from querying the existing user, we must synchronously
            // start the next put request. Adding asynchronous OpenCrypto calls in between de-synchronizes it.

            const crypt = new OpenCrypto();
            const keyPair = await crypt.getRSAKeyPair(
                4096,
                'SHA-512',
                'RSA-OAEP',
                [
                    'encrypt',
                    'decrypt'
                ],
                true);

            const encryptedPrivateKey = await crypt.encryptPrivateKey(
                keyPair.privateKey,
                password,
                100_000,
                'SHA-512',
                'AES-GCM',
                256);

            await runUnderUserStore(createUserImplementation, {
                encryptedPrivateKey,
                keyPair
            });
        } catch (e) {
            error(`Error: ${e && e.message || e}`);
            throw(e);
        } finally {
            $creatingUser = false;
        }
    };

    const onKeyPress = async (e: KeyboardEvent) => e.key === 'Enter' && await createUser();

    async function createUserImplementation(
        userStore: UserStore,
        state: {
            keyPair: any,
            encryptedPrivateKey: any
        }) {

        const lowercasedEmailAddress = localEmailAddress.toLowerCase();
        const existingUser = await userStore.getUser(
            lowercasedEmailAddress,
            async (existingUser: IUser) => {
                if (existingUser) {
                    return;
                }

                await userStore.putUser({
                    lowercasedEmailAddress,
                    encryptedPrivateKey: state.encryptedPrivateKey,
                    publicKey: state.keyPair.publicKey
                });

                emailAddress.set(localEmailAddress);
                publicKey.set(state.keyPair.publicKey);
                privateKey.set(state.keyPair.privateKey);
            });
        if (existingUser) {
            feedback = 'User already exists with this Email';
            emailAddressInvalid = true;
            return;
        }
    }
</script>

<Modal { close }>
    <h2 slot=title>New user</h2>
    <div slot=content>
        <label for=newEmail>Email:</label>
        <input type=email id=newEmail bind:value={ localEmailAddress } on:keypress={ onKeyPress }
               class:invalid={ emailAddressInvalid } disabled={ $creatingUser }
               bind:this={ emailInput } />
        <br />
        <label for=newPassword>Password:</label>
        <input type=password id=newPassword bind:value={ password } on:keypress={ onKeyPress }
               class:invalid={ passwordInvalid } disabled={ $creatingUser } />
        <br />
        <label for=confirmPassword>Confirm password:</label>
        <input type=password id=confirmPassword bind:value={ confirmPassword } on:keypress={ onKeyPress }
                class:invalid={ confirmPasswordInvalid } disabled={ $creatingUser } />
        <br />
        <br />
        <input type=button value="Create user" on:click={ createUser } disabled={ $creatingUser } />
        { #if (feedback) }
            <br />
            <span />
            { feedback }
        { /if }
    </div>
</Modal>

<style>
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

    @media (min-width: 640px) {
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
