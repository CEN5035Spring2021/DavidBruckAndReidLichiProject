<script lang=ts>
    import { writable } from 'svelte/store';

    import { organizationGroups, selectedOrganization } from '../stores/organization';
    import CreateGroup from './CreateGroup.svelte';
    import Group from './Group.svelte';

    let clazz: string;
    export { clazz as class };

    let createGroupModalOpen : boolean;
    const creatingGroup = writable(false);

    $: ensuredClass = clazz?.split(' ')?.some(className => className === 'groups')
        ? clazz
        : `${clazz} groups`;

    const createGroup = () => !$creatingGroup && (createGroupModalOpen = true);
    const closeGroupCreation = () => $creatingGroup as boolean || (createGroupModalOpen = false);
</script>

<div class={ ensuredClass }>
    <h2 class=header>Groups</h2>
    <div class=items>
        { #if $selectedOrganization }
            <ul>
                { #each $organizationGroups as group }
                    <Group { group } />
                { /each }
            </ul>
            <input type=button value="Create new group" on:click={ createGroup } />
            <br />
        { :else }
            <h3>Select an organization</h3>
        { /if }
    </div>
</div>

{ #if createGroupModalOpen }
    <CreateGroup { creatingGroup } close={ closeGroupCreation } />
{ /if }

<style>
    .groups {
        display: grid;
        grid-template-rows: 52px 1fr;
        grid-template-areas: "header"
                             "items ";
    }
    .header {
        grid-area: header;
    }
    .items {
        grid-area: items;
        overflow: auto;
    }

    input[ type=button ] {
        width: 100%;
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    ul {
        list-style: none;
        padding-left: 0;
    }
</style>
