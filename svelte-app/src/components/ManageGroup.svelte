<script lang=ts>
    import { onDestroy, onMount } from 'svelte';
    import Modal from './Modal.svelte';
    import type { IOrganizationUser } from '../stores/user';
    import { emailAddress } from '../stores/user';
    import { sign } from '../modules/sign';
    import type { CreateGroupUserRequest } from '../modules/serverInterfaces';
    import { CreateGroupUserResponseType } from '../modules/serverInterfaces';
    import type { CreateGroupUserResponse } from '../modules/serverInterfaces';
    import OpenCrypto from 'opencrypto';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import { organizationUsers, runUnderOrganizationStore, selectedOrganization } from '../stores/organization';
    import type { Writable } from 'svelte/store';
    import { readable } from 'svelte/store';
    import { writable } from 'svelte/store';
    import { globalFeedback, subscribePleaseWait } from '../stores/globalFeedback';
    import { api } from '../modules/api';
    import type { IGroup } from '../stores/group';
    import { selectedGroup, groupUsers } from '../stores/group';
    import AddExistingUserToGroup from './AddExistingUserToGroup.svelte';
    import { emailAddressMatch } from '../modules/emailAddressMatch';

    export let close: () => void;
    export let creatingGroupUser: Writable<boolean>;

    const POST = 'POST';

    let newEmailAddressInput: HTMLInputElement;
    let feedback: string;
    let newEmailAddress = writable<string>('');
    let newEmailAddressInvalid: boolean;

    function getUnAddedGroupUsers(
        { groupUsers, organizationUsers } : {
            groupUsers: IOrganizationUser[];
            organizationUsers: IOrganizationUser[];
        }) {
        const addedUsers = new Set(groupUsers.map(groupUser => groupUser.emailAddress));
        return organizationUsers.filter(
            organizationUser => !addedUsers.has(organizationUser.emailAddress));
    }

    let unAddedGroupUsers = readable<IOrganizationUser[]>(
        getUnAddedGroupUsers({
            groupUsers: $groupUsers as IOrganizationUser[],
            organizationUsers: $organizationUsers as IOrganizationUser[]
        }),
        set => {
            const groupUsersUnsubscribe = groupUsers.subscribe(value => set(getUnAddedGroupUsers({
                groupUsers: value,
                organizationUsers: $organizationUsers as IOrganizationUser[]
            })));
            const organizationUsersUnsubscribe = organizationUsers.subscribe(value => set(getUnAddedGroupUsers({
                groupUsers: $groupUsers as IOrganizationUser[],
                organizationUsers: value
            })));

            return () => {
                groupUsersUnsubscribe();
                organizationUsersUnsubscribe();
            };
        });
    $: unAddedGroupUsersLength = ($unAddedGroupUsers as IOrganizationUser[]).length;

    onMount(() => newEmailAddressInput.focus());

    const createGroupUser = async() => {
        const error = (err: string) => {
            if (!feedback) {
                feedback = err;
            }
        };

        feedback = '';
        newEmailAddressInvalid = false;

        if (!$newEmailAddress) {
            error('Email is required');
            newEmailAddressInvalid = true;
        }
        if (!emailAddressMatch($newEmailAddress)) {
            error(
                'Email must contain characters to the left and right of a single at (@) sign,\n' +
                'and no underscrores (_) to the right');
            newEmailAddressInvalid = true;
        }

        if (feedback) {
            return;
        }

        $creatingGroupUser = true;
        try {
            const crypt = new OpenCrypto();
            const url = `${getDefaultFunctionsUrl()}api/creategroupuser`;
            const createGroupUserRequest = await sign<CreateGroupUserRequest>({
                url,
                method: POST,
                body: {
                    groupUserEmailAddress: $newEmailAddress as string,
                    organizationName: $selectedOrganization as string,
                    groupName: ($selectedGroup as IGroup).name,
                    emailAddress: $emailAddress as string
                },
                crypt
            });

            const response = await api<CreateGroupUserResponse>({
                method: POST,
                url,
                body: createGroupUserRequest
            });
            switch (response.type) {
                case CreateGroupUserResponseType.Created: {
                    feedback = 'Created';
                    const user = response.users[0];
                    await runUnderOrganizationStore(organizationStore => organizationStore.appendGroupUser({
                        user: {
                            emailAddress: user.emailAddress,
                            encryptionPublicKey: user.encryptionPublicKey
                        }
                    }));
                    break;
                }
                case CreateGroupUserResponseType.ConfirmationEmailSent:
                    feedback = 'Confirmation email sent';
                    break;
                case CreateGroupUserResponseType.AlreadyExists: {
                    feedback = 'User already added to group';
                    const user = response.users[0];
                    await runUnderOrganizationStore(organizationStore => organizationStore.appendGroupUser({
                        user: {
                            emailAddress: user.emailAddress,
                            encryptionPublicKey: user.encryptionPublicKey
                        }
                    }));
                    break;
                }
                default:
                    feedback = `Unexpected server response type ${response.type as string}`;
                    break;
            }
        } catch (e) {
            error(`Error: ${e && (e as { message: string }).message || e as string}`);
            throw (e);
        } finally {
            $creatingGroupUser = false;
        }
    };
    const safeCreateGroupUser: () => void = () => createGroupUser().catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeCreateGroupUser: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await createGroupUser();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeOnKeyPress: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));

    const pleaseWaitSubscription = subscribePleaseWait(creatingGroupUser, 'Creating group user...');
    onDestroy(pleaseWaitSubscription);
</script>

<Modal { close }>
    <h2 slot=title>New group user</h2>
    <div slot=content>
        { #if unAddedGroupUsersLength }
            <h3>Add existing organization user to group</h3>
            <ul>
                { #each $unAddedGroupUsers as user }
                    <AddExistingUserToGroup { user } { newEmailAddress } { safeCreateGroupUser } { creatingGroupUser } />
                { /each }
            </ul>
            <br />
            <h3>Or invite new user to group</h3>
        { :else }
            <h3>Invite new user to group</h3>
        { /if }
        <label for=newEmail>Email:</label>
        <input id=newEmail type=email bind:value={ $newEmailAddress } on:keypress={ safeOnKeyPress }
               class:invalid={ newEmailAddressInvalid } disabled={ $creatingGroupUser }
               bind:this={ newEmailAddressInput } />
        <br />
        <br />
        <input type=button value="Invite group user" on:click={ safeCreateGroupUser }
               disabled={ $creatingGroupUser } />
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

    ul {
        list-style: none;
        padding-left: 0;
    }
</style>
