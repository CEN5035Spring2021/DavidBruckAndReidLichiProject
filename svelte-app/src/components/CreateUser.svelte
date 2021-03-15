<script lang=ts>
    import { onMount } from 'svelte';
    import {
        emailAddress, encryptionPrivateKey, encryptionPublicKey, signingPrivateKey, signingPublicKey, runUnderUserStore
    } from '../stores/user';
    import type { UserStore, IUser } from '../stores/user';
    import Modal from './Modal.svelte';
    import OpenCrypto from 'opencrypto';
    import type { Writable } from 'svelte/store';

    export let close: () => void;
    export let creatingUser: Writable<boolean>;

    const RSA_KEY_LENGTH = 4096;
    const PASSWORD_SALT_ITERATIONS = 100_000;
    const SHA_SIZE = 256;

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
        const error = (err: string) => {
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
            const encryptionKeyPair = await crypt.getRSAKeyPair(
                RSA_KEY_LENGTH,
                'SHA-512',
                'RSA-OAEP',
                [
                    'encrypt',
                    'decrypt'
                ],
                true) as { privateKey: CryptoKey, publicKey: CryptoKey };
            const signingKeyPair = await crypt.getRSAKeyPair(
                RSA_KEY_LENGTH,
                'SHA-512',
                'RSA-PSS',
                [
                    'sign',
                    'verify'
                ],
                true) as { privateKey: CryptoKey, publicKey: CryptoKey };

            const encryptedEncryptionKey = await crypt.encryptPrivateKey(
                encryptionKeyPair.privateKey,
                password,
                PASSWORD_SALT_ITERATIONS,
                'SHA-512',
                'AES-GCM',
                SHA_SIZE) as string;
            const encryptedSigningKey = await crypt.encryptPrivateKey(
                signingKeyPair.privateKey,
                password,
                PASSWORD_SALT_ITERATIONS,
                'SHA-512',
                'AES-GCM',
                SHA_SIZE) as string;

            const existingUser = await runUnderUserStore(
                createUserImplementation,
                {
                    encryptionKey: encryptionKeyPair.privateKey,
                    signingKey: signingKeyPair.privateKey,
                    encryptedEncryptionKey,
                    encryptedSigningKey
                });
            if (existingUser) {
                feedback = 'User already exists with this Email';
                emailAddressInvalid = true;
                return;
            }

            $emailAddress = localEmailAddress;
            $encryptionPrivateKey = encryptionKeyPair.privateKey;
            $encryptionPublicKey = encryptionKeyPair.publicKey;
            $signingPrivateKey = signingKeyPair.privateKey;
            $signingPublicKey = signingKeyPair.publicKey;
        } catch (e) {
            error(`Error: ${e && (e as {message: string}).message || e as string}`);
            throw(e);
        } finally {
            $creatingUser = false;
        }
    };
    const safeCreateUser = () => createUser().catch(console.error);

    const onKeyPress = async (e: KeyboardEvent) => e.key === 'Enter' && await createUser();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(console.error);

    async function createUserImplementation(
        userStore: UserStore,
        state: {
            encryptionKey: CryptoKey,
            signingKey: CryptoKey,
            encryptedEncryptionKey: string,
            encryptedSigningKey: string
        }) {

        const lowercasedEmailAddress = localEmailAddress.toLowerCase();
        const existingUser = await userStore.getUser(
            lowercasedEmailAddress,
            async (existingUser: IUser) => {
                if (existingUser
                    && existingUser.encryptedEncryptionKey
                    && existingUser.encryptedSigningKey) {
                    return;
                }

                await userStore.putUser({
                    lowercasedEmailAddress,
                    encryptedEncryptionKey: state.encryptedEncryptionKey,
                    encryptedSigningKey: state.encryptedSigningKey
                });
            });
        return existingUser
            && existingUser.encryptedEncryptionKey
            && existingUser.encryptedSigningKey;
    }
</script>

<Modal { close }>
    <h2 slot=title>New user</h2>
    <div slot=content>
        <label for=newEmail>Email:</label>
        <input type=email id=newEmail bind:value={ localEmailAddress } on:keypress={ safeOnKeyPress }
               class:invalid={ emailAddressInvalid } disabled={ $creatingUser } bind:this={ emailInput } />
        <br />
        <label for=newPassword>Password:</label>
        <input type=password id=newPassword bind:value={ password } on:keypress={ safeOnKeyPress }
               class:invalid={ passwordInvalid } disabled={ $creatingUser } />
        <br />
        <label for=confirmPassword>Confirm password:</label>
        <input type=password id=confirmPassword bind:value={ confirmPassword } on:keypress={ safeOnKeyPress }
               class:invalid={ confirmPasswordInvalid } disabled={ $creatingUser } />
        <br />
        <br />
        <input type=button value="Create user" disabled={ $creatingUser } on:click={ safeCreateUser } />
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
