<script lang=ts>
    import { onMount } from 'svelte';
    import { emailAddress, publicKey, privateKey } from '../stores/user';
    import Modal from './Modal.svelte';
    import OpenCrypto from 'opencrypto';

    export let close: () => void;

    let emailInput: HTMLInputElement;
    let feedback: string;
    let localEmailAddress: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let confirmPassword: string;
    let confirmPasswordInvalid: boolean;
    let creatingUser: boolean;

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

        creatingUser = true;

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

        const db = indexedDB.open('SecureGroupMessenger');

        const storeName = 'UserStore';
        db.onupgradeneeded = () => db.result.createObjectStore(
            storeName,
            {
                keyPath: 'emailAddress'
            });

        db.onsuccess = () => {
            const connection = db.result;
            const transaction = connection.transaction(storeName, 'readwrite');
            transaction.oncomplete = () => {
                connection.close();
            };

            const objectStore = transaction.objectStore(storeName);

            const lowercasedEmailAddress = localEmailAddress.toLowerCase();
            const countRequest = objectStore.count(lowercasedEmailAddress);
            countRequest.onsuccess = () => {
                if (countRequest.result) {
                    error('User already exists with this Email');
                    emailAddressInvalid = true;
                    creatingUser = false;
                    return;
                }

                const putRequest = objectStore.put({
                    emailAddress: lowercasedEmailAddress,
                    encryptedPrivateKey,
                    publicKey: keyPair.publicKey
                });

                putRequest.onsuccess = () => {
                    emailAddress.set(localEmailAddress);
                    publicKey.set(keyPair.publicKey);
                    privateKey.set(keyPair.privateKey);
                    creatingUser = false;
                };
            };
        };
    };

    const onKeyPress = async (e: KeyboardEvent) => e.key === 'Enter' && await createUser();
</script>

<Modal { close }>
    <h2 slot=title>New user</h2>
    <div slot=content>
        <label for=newEmail>Email:</label>
        <input type=email id=newEmail bind:value={ localEmailAddress } on:keypress={ onKeyPress }
               class:invalid={ emailAddressInvalid } disabled={ creatingUser }
               bind:this={ emailInput } />
        <br />
        <label for=newPassword>Password:</label>
        <input type=password id=newPassword bind:value={ password } on:keypress={ onKeyPress }
               class:invalid={ passwordInvalid } disabled={ creatingUser } />
        <br />
        <label for=confirmPassword>Confirm password:</label>
        <input type=password id=confirmPassword bind:value={ confirmPassword } on:keypress={ onKeyPress }
                class:invalid={ confirmPasswordInvalid } disabled={ creatingUser } />
        <br />
        <br />
        <input type=button value="Create user" on:click={ createUser } disabled={ creatingUser } />
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
