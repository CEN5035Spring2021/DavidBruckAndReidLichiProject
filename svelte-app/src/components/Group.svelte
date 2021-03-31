<script lang=ts>
    import type { IGroup } from '../stores/group';
import { selectedGroup } from '../stores/group';

    export let group: IGroup;

    $: groupSelected = $selectedGroup === group;
    let groupName = group.name;

    const selectGroup = () => $selectedGroup = group;
</script>

<li class:selected={ groupSelected } on:click={ selectGroup }>
    { groupName }
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
