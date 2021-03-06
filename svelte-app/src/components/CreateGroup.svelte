<script lang=ts>
    import { onDestroy, onMount } from 'svelte';
    import Modal from './Modal.svelte';
    import { emailAddress } from '../stores/user';
    import { sign } from '../modules/sign';
    import type { CreateGroupRequest } from '../modules/serverInterfaces';
    import { CreateGroupResponse } from '../modules/serverInterfaces';
    import OpenCrypto from 'opencrypto';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import { selectedOrganization } from '../stores/organization';
    import type { Writable } from 'svelte/store';
    import { globalFeedback, subscribePleaseWait } from '../stores/globalFeedback';
    import { api } from '../modules/api';
    import { runUnderGroupStore, selectedGroup } from '../stores/group';

    export let close: () => void;
    export let creatingGroup: Writable<boolean>;

    const POST = 'POST';

    let nameInput: HTMLInputElement;
    let feedback: string;
    let name: string;
    let nameInvalid: boolean;

    onMount(() => nameInput.focus());

    const createGroup = async() => {
        if (name) {
            feedback = '';
            nameInvalid = false;
        } else {
            feedback = 'Name is required';
            nameInvalid = true;
            return;
        }

        $creatingGroup = true;
        try {
            const crypt = new OpenCrypto();
            const url = `${getDefaultFunctionsUrl()}api/creategroup`;
            const createGroupRequest = await sign<CreateGroupRequest>({
                url,
                method: POST,
                body: {
                    name,
                    organizationName: $selectedOrganization as string,
                    emailAddress: $emailAddress as string
                },
                crypt
            });

            const response = await api<CreateGroupResponse>({
                method: POST,
                url,
                body: createGroupRequest
            });
            switch (response) {
                case CreateGroupResponse.Created: {
                    feedback = 'Created';
                    const group = {
                        name
                    };
                    await runUnderGroupStore(groupStore => groupStore.append({
                        organizationName: $selectedOrganization as string,
                        group
                    }));
                    $selectedGroup = group;
                    break;
                }
                case CreateGroupResponse.AlreadyExists:
                    feedback = 'Group already exists';
                    break;
                default:
                    feedback = `Unexpected server response type ${response as string}`;
                    break;
            }
        } catch (e) {
            feedback = `Error: ${e && (e as { message: string }).message || e as string}`;
            throw (e);
        } finally {
            $creatingGroup = false;
        }
    };
    const safeCreateGroup: () => void = () => createGroup().catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeCreateGroup: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await createGroup();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeOnKeyPress: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const pleaseWaitSubscription = subscribePleaseWait(creatingGroup, 'Creating group...');
    onDestroy(pleaseWaitSubscription);
</script>

<Modal { close }>
    <h2 slot=title>New group</h2>
    <div slot=content>
        <label for=newName>Name:</label>
        <input id=newName bind:value={ name } on:keypress={ safeOnKeyPress }
               class:invalid={ nameInvalid } disabled={ $creatingGroup }
               bind:this={ nameInput } />
        <br />
        <br />
        <input type=button value="Create group" on:click={ safeCreateGroup }
               disabled={ $creatingGroup } />
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
