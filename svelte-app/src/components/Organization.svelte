<script lang=ts>
    import type { IOrganization } from '../stores/organization';
    import { selectedOrganization } from '../stores/organization';

    export let organization: IOrganization;

    $: organizationSelected = $selectedOrganization === organization.name;
    let organizationName = organization.name;

    const selectOrganization = () => $selectedOrganization = organization.name;
</script>

<li class:selected={ organizationSelected } on:click={ selectOrganization }>
    { organizationName }
</li>

<style>
    li {
        border: 1px solid black;
    }
        li:hover:not(.selected) {
            cursor: pointer;
            background-color: #efefef;
        }
        li.selected {
            background-color: #85c0f9;
        }
</style>
