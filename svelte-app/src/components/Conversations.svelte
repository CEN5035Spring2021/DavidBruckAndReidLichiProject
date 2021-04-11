<script lang=ts>
    import { selectedConversation, selectedUser } from '../stores/conversation';
    import type { IConversation } from '../stores/group';
    import type { IOrganizationUser } from '../stores/user';

    let clazz: string;
    export { clazz as class };

    $: usersEmailAddresses = ($selectedConversation as IConversation)
        ? ($selectedConversation as IConversation).users.map(user => user.emailAddress).join(', ')
        : ($selectedUser as IOrganizationUser | undefined)?.emailAddress || '';
</script>

<div class={ clazz }>
    <h2>Conversations</h2>
    <h3>{ usersEmailAddresses }</h3>
</div>

<style>
    h2 {
        margin-bottom: 0;
    }
    h3 {
        margin-top: 0;
    }
</style>
