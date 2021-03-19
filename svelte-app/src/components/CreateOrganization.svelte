<script lang=ts>
    import { onMount } from 'svelte';
    import Modal from './Modal.svelte';
    import { emailAddress, encryptionPublicKey, signingPublicKey } from '../stores/user';
    import { sign } from '../modules/sign';
    import type { CreateOrganizationRequest, CreateOrganizationResponse } from '../modules/serverInterfaces';
    import OpenCrypto from 'opencrypto';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';

    export let close: () => void;

    const READY = 4; // XHR Ready
    const OK = 200; // HTTP status

    let creatingOrganization = false;
    let nameInput: HTMLInputElement;
    let feedback: string;
    let name: string;
    let nameInvalid: boolean;

    onMount(() => nameInput.focus());

    const createOrganization = async () => {
        const error = (err: string) => {
            if (!feedback) {
                feedback = err;
            }
        };

        if (name) {
            feedback = '';
            nameInvalid = false;
        } else {
            feedback = 'Name is required';
            nameInvalid = true;
            return;
        }

        creatingOrganization = true;
        try {
            const crypt = new OpenCrypto();
            const createOrganizationRequest = await sign<CreateOrganizationRequest>(
                {
                    name,
                    emailAddress: $emailAddress as string,
                    encryptionKey: await crypt.cryptoPublicToPem($encryptionPublicKey as CryptoKey) as string,
                    signingKey: await crypt.cryptoPublicToPem($signingPublicKey as CryptoKey) as string
                },
                crypt);

            const response = await new Promise<CreateOrganizationResponse>(
                (resolve, reject) => {
                    let xhr = new XMLHttpRequest();
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
            feedback = `Server response: ${response}`;
        } catch (e) {
            error(`Error: ${e && (e as {message: string}).message || e as string}`);
            throw(e);
        } finally {
            creatingOrganization = false;
        }
    };
    const safeCreateOrganization: () => void = () => createOrganization().catch(console.error);

    const onKeyPress = async (e: KeyboardEvent) => e.key === 'Enter' && await createOrganization();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(console.error);
</script>

<Modal { close }>
    <h2 slot=title>New organization</h2>
    <div slot=content>
        <label for=newName>Name:</label>
        <input id=newName bind:value={ name } on:keypress={ safeOnKeyPress }
               class:invalid={ nameInvalid } disabled={ creatingOrganization }
               bind:this={ nameInput } />
        <br />
        <br />
        <input type=button value="Create organization" on:click={ safeCreateOrganization }
               disabled={ creatingOrganization } />
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