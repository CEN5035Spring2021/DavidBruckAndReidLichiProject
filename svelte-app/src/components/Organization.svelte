<script lang=ts>
    import { selectedOrganization } from '../stores/organization';

    export let organization: string;

    $: organizationSelected = $selectedOrganization === organization;

    const selectOrganization = () => $selectedOrganization = organization;
</script>

<li class:selected={ organizationSelected } on:click={ selectOrganization }>
    { organization }
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
