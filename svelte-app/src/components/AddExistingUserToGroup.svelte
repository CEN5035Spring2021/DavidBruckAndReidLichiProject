<script lang=ts>
    import type { Readable, Writable } from 'svelte/store';
    import type { IOrganizationUser } from '../stores/user';

    export let user: IOrganizationUser;
    export let newEmailAddress: Writable<string>;
    export let safeCreateGroupUser: () => void;
    export let creatingGroupUser: Readable<boolean>;

    $: emailAddress = user.emailAddress;

    const createGroupUser = () => {
        if (!$creatingGroupUser) {
            $newEmailAddress = emailAddress as string;
            safeCreateGroupUser();
        }
    };
</script>

<li on:click={ createGroupUser }>
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
