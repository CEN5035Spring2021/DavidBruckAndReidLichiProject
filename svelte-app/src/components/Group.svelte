<script lang=ts>
    import { writable } from 'svelte/store';
    import { conversations, usersNotInConversation } from '../stores/conversation';
    import type { IGroup } from '../stores/group';
    import { selectedGroup } from '../stores/group';
    import { isOrganizationAdmin } from '../stores/organization';
    import Conversation from './Conversation.svelte';
    import ManageGroup from './ManageGroup.svelte';

    export let group: IGroup;

    let manageGroupModalOpen : boolean;
    const creatingGroupUser = writable(false);

    $: groupSelected = $selectedGroup === group;
    $: groupName = group.name;

    const selectGroup = () => $selectedGroup = group;
    const manageGroup = () => !$creatingGroupUser && (manageGroupModalOpen = true);
    const closeGroupManagement = () => $creatingGroupUser as boolean || (manageGroupModalOpen = false);
</script>

<li class:selected={ groupSelected }>
    <div on:click={ selectGroup }>{ groupName }</div>
    { #if groupSelected }
        <hr />
        { #each $conversations as conversation }
            <Conversation { conversation } class=conversation />
        { /each }
        { #each $usersNotInConversation as user }
            <Conversation { user } class=conversation />
        { /each }
        { #if $isOrganizationAdmin }
            <button on:click={ manageGroup }>Manage group</button>
        { /if }
        <hr />
    { /if }

    { #if manageGroupModalOpen }
        <ManageGroup { creatingGroupUser } close={ closeGroupManagement } />
    { /if }
</li>

<style>
    :global(.conversation + .conversation) {
        border-top: none;
    }
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
        li.selected > div:first-of-type {
            background-color: #85c0f9;
        }
    hr {
        margin: 0;
        border-width: 4px;
    }
    button {
        margin: 10px 0 0 0;
        padding: 0;
        width: 100%;
        cursor: pointer;
        background-color: #efefef;
        color: #000;
        white-space: nowrap;
    }
        button::before, button::after {
            content: " ⊕ ";
            font-weight: bolder;
            color: #f5793a;
        }
</style>
