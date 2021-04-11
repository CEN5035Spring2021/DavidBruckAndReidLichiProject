<script lang=ts>
    import { selectedConversation, selectedUser } from '../stores/conversation';
    import type { IConversation } from '../stores/group';
    import type { IOrganizationUser } from '../stores/user';

    let clazz: string;
    export { clazz as class };
    export let conversation: IConversation = undefined;
    export let user: IOrganizationUser = undefined;

    $: conversationSelected = conversation
        ? $selectedConversation === conversation
        : $selectedUser === user;

    $: combinedClass = `${clazz}${conversationSelected ? ' selected' : ''}`;

    $: usersEmailAddresses = conversation
        ? conversation.users.map(user => user.emailAddress).join(', ')
        : user.emailAddress;

    const selectConversation = () => conversation
        ? $selectedConversation = conversation
        : $selectedUser = user;
</script>

<div class={ combinedClass } on:click={ selectConversation }>
    { usersEmailAddresses }
</div>

<style>
    div {
        margin: 0px 5px;
        border: 1px solid black;
    }
        div:hover:not(.selected) {
            cursor: pointer;
            background-color: #efefef;
        }
        div.selected {
            background-color: #85c0f9;
        }
</style>
