<script lang=ts>
    import { onDestroy, onMount } from 'svelte';
    import Modal from './Modal.svelte';
    import { emailAddress, encryptionPublicKey, signingPublicKey } from '../stores/user';
    import { sign } from '../modules/sign';
    import { CreateOrganizationResponseType } from '../modules/serverInterfaces';
    import type { CreateOrganizationRequest, CreateOrganizationResponse } from '../modules/serverInterfaces';
    import OpenCrypto from 'opencrypto';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import { runUnderOrganizationStore, selectedOrganization } from '../stores/organization';
    import type { Writable } from 'svelte/store';
    import { globalFeedback, subscribePleaseWait } from '../stores/globalFeedback';
    import { api } from '../modules/api';

    export let close: () => void;
    export let creatingOrganization: Writable<boolean>;

    const POST = 'POST';

    let nameInput: HTMLInputElement;
    let feedback: string;
    let name: string;
    let nameInvalid: boolean;

    onMount(() => nameInput.focus());

    const createOrganization = async() => {
        if (name) {
            feedback = '';
            nameInvalid = false;
        } else {
            feedback = 'Name is required';
            nameInvalid = true;
            return;
        }

        $creatingOrganization = true;
        try {
            const crypt = new OpenCrypto();
            const url = `${getDefaultFunctionsUrl()}api/createorganization`;
            const createOrganizationRequest = await sign<CreateOrganizationRequest>({
                url,
                method: POST,
                body: {
                    name,
                    emailAddress: $emailAddress as string,
                    encryptionKey: await crypt.cryptoPublicToPem($encryptionPublicKey as CryptoKey) as string,
                    signingKey: await crypt.cryptoPublicToPem($signingPublicKey as CryptoKey) as string
                },
                crypt
            });

            const response = await api<CreateOrganizationResponse>({
                method: POST,
                url,
                body: createOrganizationRequest
            });
            switch (response.type) {
                case CreateOrganizationResponseType.Created:
                    feedback = 'Created';
                    await runUnderOrganizationStore(organizationStore => organizationStore.append({
                        name: response.name,
                        users: [
                            {
                                emailAddress: $emailAddress as string
                            }
                        ],
                        admin: true
                    }));
                    $selectedOrganization = response.name;
                    break;
                case CreateOrganizationResponseType.AlreadyExists:
                    feedback = 'Organization already exists';
                    break;
                case CreateOrganizationResponseType.ConfirmationEmailSent:
                    feedback = 'Confirmation email sent';
                    break;
                default:
                    feedback = `Unexpected server response type ${response.type as string}`;
                    break;
            }
        } catch (e) {
            feedback = `Error: ${e && (e as { message: string }).message || e as string}`;
            throw (e);
        } finally {
            $creatingOrganization = false;
        }
    };
    const safeCreateOrganization: () => void = () => createOrganization().catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeCreateOrganization: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await createOrganization();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeOnKeyPress: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const pleaseWaitSubscription = subscribePleaseWait(creatingOrganization, 'Creating organization...');
    onDestroy(pleaseWaitSubscription);
</script>

<Modal { close }>
    <h2 slot=title>New organization</h2>
    <div slot=content>
        <label for=newName>Name:</label>
        <input id=newName bind:value={ name } on:keypress={ safeOnKeyPress }
               class:invalid={ nameInvalid } disabled={ $creatingOrganization }
               bind:this={ nameInput } />
        <br />
        <br />
        <input type=button value="Create organization" on:click={ safeCreateOrganization }
               disabled={ $creatingOrganization } />
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
