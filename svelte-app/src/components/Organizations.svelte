<script lang=ts>
    import { organizations, switchingOrganization } from '../stores/organization';
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

    const createOrganization = () =>
        !$creatingOrganization && !$switchingOrganization && (createOrganizationModalOpen = true);
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
        <button on:click={ createOrganization }>Create new organization</button>
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

    button {
        padding: 5px 10px;
        cursor: pointer;
        background-color: #efefef;
        color: #000;
        white-space: nowrap;
    }
        button::before, button::after {
            content: "\00A0\2295\00A0";
            font-weight: bolder;
            color: #f5793a;
            vertical-align: baseline;
            font-size: 18px;
        }

    ul {
        list-style: none;
        padding-left: 0;
    }
</style>
