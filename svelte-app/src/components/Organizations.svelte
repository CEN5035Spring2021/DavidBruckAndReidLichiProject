<script lang=ts>
    import { organizations } from '../stores/organization';
    import { writable } from 'svelte/store';
    import CreateOrganization from './CreateOrganization.svelte';
    import Organization from './Organization.svelte';

    let clazz: string;
    export { clazz as class };

    let createOrganizationModalOpen : boolean;
    const creatingOrganization = writable(false);

    $: ensuredClass = clazz?.split(' ')?.some(className => className === 'organizations')
        ? clazz
        : `${clazz} organizations`;

    const createOrganization = () => !$creatingOrganization && (createOrganizationModalOpen = true);
    const closeOrganizationCreation = () => $creatingOrganization as boolean || (createOrganizationModalOpen = false);
</script>

<div class={ ensuredClass }>
    <h2 class=header>Organizations</h2>
    <div class=items>
        <ul>
            { #each $organizations as organization }
                <Organization { organization } />
            {/each }
        </ul>
        <input type=button value="Create new organization" on:click={ createOrganization } />
        <br />
    </div>
</div>

{ #if createOrganizationModalOpen }
    <CreateOrganization { creatingOrganization } close={ closeOrganizationCreation } />
{ /if }

<style>
    .organizations {
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
