<script lang=ts>
    export let user: string;
    export let addUserToConversation: (user: string) => void;

    const addUserToConversationImpl = () => addUserToConversation(user);
</script>

<li on:click={ addUserToConversationImpl }>
    { user }
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
