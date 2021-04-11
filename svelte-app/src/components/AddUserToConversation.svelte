<script lang=ts>
    import type { IOrganizationUser } from '../stores/user';

    export let user: IOrganizationUser;
    export let addUserToConversation: (user: IOrganizationUser) => void;

    const addUserToConversationImpl = () => addUserToConversation(user);

    $: emailAddress = user.emailAddress;
</script>

<li on:click={ addUserToConversationImpl }>
    { emailAddress }
</li>

<style>
    li {
        margin: 0px 5px;
        border: 1px solid black;
    }
        li:not(:first-of-type) {
            border-top: none;
        }
        li:hover:not(.selected) {
            cursor: pointer;
            background-color: #efefef;
        }
</style>
