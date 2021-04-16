<script lang=ts>
    import { writable } from 'svelte/store';
    import { conversationUsers } from '../stores/conversation';
    import { selectedGroup } from '../stores/group';
    import { groupUsers } from '../stores/group';
    import type { IOrganizationUser } from '../stores/user';
    import { onDestroy } from 'svelte';
    import EditConversationUsers from './EditConversationUsers.svelte';
    import Messages from './Messages.svelte';

    let clazz: string;
    export { clazz as class };

    const editingConversationUsers = writable<boolean>(false);

    $: ensuredClass = clazz?.split(' ')?.some(className => className === 'conversations')
        ? clazz
        : `${clazz} conversations`;

    $: usersEmailAddresses = ($conversationUsers as string[]).length
        ? ($conversationUsers as string[]).join(', ')
        : ($groupUsers as IOrganizationUser[]).length ? 'Start a conversation' : '';
    $: conversationUsersLength = ($conversationUsers as IOrganizationUser[]).length;

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

<div class={ ensuredClass }>
    <h2>Conversations</h2>
    <h3 class:nonEmptyUsersEmailAddresses={ usersEmailAddresses } on:click={ editConversationUsers }>
        { usersEmailAddresses }
    </h3>
    { #if conversationUsersLength }
        <Messages />
    { /if }
</div>

{ #if $editingConversationUsers }
    <EditConversationUsers close={ stopEditingConversationUsers } { conversationUsers } />
{ /if }

<style>
    div.conversations {
        display: grid;
        grid-template-rows: auto auto 1fr auto auto;
        grid-template-areas: "header"
                             "conversationUsers"
                             "messages"
                             "newMessage"
                             "sendMessage";
    }
        div.conversations > h2 {
            grid-area: header;
        }
        div.conversations > h3 {
            grid-area: conversationUsers;
        }

    div {
        display: flex;
        flex-direction: column;
    }
    h2 {
        margin-bottom: 0;
    }
    h3 {
        margin: 0;
    }
        h3.nonEmptyUsersEmailAddresses {
            width: 100%;
            cursor: pointer;
        }
            h3.nonEmptyUsersEmailAddresses::before, h3.nonEmptyUsersEmailAddresses::after {
                content: " \2295 ";
                font-weight: bolder;
                color: #f5793a;
            }
</style>
