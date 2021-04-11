<script lang=ts>
    import { writable } from 'svelte/store';
    import { conversationUsers } from '../stores/conversation';
    import { selectedGroup } from '../stores/group';
    import { groupUsers } from '../stores/group';
    import type { IOrganizationUser } from '../stores/user';
    import { onDestroy } from 'svelte';
    import EditConversationUsers from './EditConversationUsers.svelte';

    let clazz: string;
    export { clazz as class };

    const editingConversationUsers = writable<boolean>(false);

    $: usersEmailAddresses = ($conversationUsers as IOrganizationUser[]).length
        ? ($conversationUsers as IOrganizationUser[]).map(conversationUser => conversationUser.emailAddress).join(', ')
        : ($groupUsers as IOrganizationUser[]).length ? 'Start a conversation' : '';

    const editConversationUsers = () => {
        if (!usersEmailAddresses) {
            return '';
        }

        $editingConversationUsers = true;
    };
    const stopEditingConversationUsers = () => {
        $editingConversationUsers = false;
    };

    const selectedGroupSubscription = selectedGroup.subscribe(
        () => $editingConversationUsers = false);
    onDestroy(selectedGroupSubscription);
</script>

<div class={ clazz }>
    <h2>Conversations</h2>
    <h3 class:nonEmptyUsersEmailAddresses={ usersEmailAddresses } on:click={ editConversationUsers }>
        { usersEmailAddresses }
    </h3>
</div>

{ #if $editingConversationUsers }
    <EditConversationUsers close={ stopEditingConversationUsers } { conversationUsers } />
{ /if }

<style>
    h2 {
        margin-bottom: 0;
    }
    h3 {
        margin-top: 0;
    }
        h3.nonEmptyUsersEmailAddresses {
            width: 100%;
            cursor: pointer;
        }
            h3.nonEmptyUsersEmailAddresses::before, h3.nonEmptyUsersEmailAddresses::after {
                content: " ⊕ ";
                font-weight: bolder;
                color: #f5793a;
            }
</style>
