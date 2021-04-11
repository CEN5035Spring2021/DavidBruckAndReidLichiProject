<script lang=ts>
    import { selectedConversation, selectedUsers } from '../stores/conversation';
    import type { IConversation } from '../stores/group';
    import type { IOrganizationUser } from '../stores/user';

    let clazz: string;
    export { clazz as class };
    export let notInConversation = false;
    export let conversation: IConversation = undefined;
    export let user: IOrganizationUser = undefined;

    $: conversationSelected = conversation
        ? $selectedConversation === conversation
        : ($selectedUsers as IOrganizationUser[]).some(
            selectedUser => selectedUser === user);

    $: combinedClass =
        `${clazz}${conversationSelected ? ' selected' : ''}${notInConversation ? ' notInConversation' : ''}`;

    $: usersEmailAddresses = conversation
        ? conversation.users.map(user => user.emailAddress).join(', ')
        : user.emailAddress;

    const selectConversation = () =>
        !conversationSelected
            && (conversation
                ? $selectedConversation = conversation
                : $selectedUsers = [ user ]);
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

    .notInConversation {
        font-style: italic;
    }
</style>
