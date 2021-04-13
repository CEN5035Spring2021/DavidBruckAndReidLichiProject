<script lang=ts>
    import type { Writable } from 'svelte/store';
    import { writable } from 'svelte/store';
    import type { IOrganizationUser } from '../stores/user';
    import { emailAddress } from '../stores/user';
    import Modal from './Modal.svelte';
    import { onDestroy } from 'svelte';
    import { groupUsers } from '../stores/group';
    import AddUserToConversation from './AddUserToConversation.svelte';

    export let close: () => void;
    export let conversationUsers: Writable<string[]>;

    const editableConversationUsers = writable<string[]>($conversationUsers as string[]);

    $: usersEmailAddresses = ($editableConversationUsers as string[]).length
        ? ($editableConversationUsers as string[]).join(', ')
        : 'Add a user to the conversation';

    $: unAddedConversationUsers = ($groupUsers as IOrganizationUser[]).filter(
        (function(this: null, conversationUserEmailAddresses: Set<string>, value: IOrganizationUser) {
            const valueEmailAddressLowerCase = value.emailAddress.toLowerCase();
            return valueEmailAddressLowerCase !== ($emailAddress as string).toLowerCase()
                && !conversationUserEmailAddresses.has(valueEmailAddressLowerCase);
        }).bind(
            null,
            new Set(($editableConversationUsers as string[])
                .map(conversationUser => conversationUser.toLowerCase()))))
        .map(unAddedConversationUser => unAddedConversationUser.emailAddress);
    $: unAddedConversationUsersLength = (unAddedConversationUsers as string[]).length;
    $: editableConversationUsersLength = ($editableConversationUsers as string[]).length;

    const addUserToConversation = (user: string) =>
        editableConversationUsers.update(value =>
            (value.length && value[0].toLowerCase() === ($emailAddress as string).toLowerCase())
                ? [ user ]
                : [ ...value, user ]);

    const clear = () => $editableConversationUsers = [];
    const ok = () => {
        $conversationUsers = [ ...($editableConversationUsers as string[]) ].sort();
        close();
    };

    const conversationUsersSubscription = conversationUsers.subscribe(value => $editableConversationUsers = value);
    onDestroy(conversationUsersSubscription);
</script>

<Modal { close }>
    <h2 slot=title>{ usersEmailAddresses }</h2>
    <div slot=content>
        { #if unAddedConversationUsersLength }
            <h3>Add user to conversation</h3>
        { :else }
            <h3>All group users already added to conversation</h3>
        { /if }
        <ul>
            { #each unAddedConversationUsers as user }
                <AddUserToConversation { user } { addUserToConversation } />
            { /each }
        </ul>
        { #if editableConversationUsersLength }
            <input type=button value=Clear on:click={ clear } />
        { /if }
        <input type=button value=Ok on:click={ ok } />
    </div>
</Modal>

<style>
    input[ type=button ] {
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    ul {
        list-style: none;
        padding-left: 0;
    }
</style>
