<script lang=ts>
    import Modal from './Modal.svelte';
    import globalFeedback from '../stores/globalFeedback';

    const close = () => {
        globalFeedback.update(feedback => feedback.slice(1));
    };

    $:globalFeedbackLength = ($globalFeedback as string[]).length;
    $:globalFeedbackFirst = globalFeedbackLength && ($globalFeedback as string[])[0];
</script>

{ #if globalFeedbackLength }
    <Modal { close }>
        <h2 slot=title>An error occurred:</h2>
        <div slot=content>
            <span />
            { globalFeedbackFirst }
            <input type=button value="Ok" on:click={ close } />
        </div>
    </Modal>
{ /if }

<style>
    input {
        width: 100%;
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    span::before {
        content: "⚠";
        font-size: 1.5em;
        font-weight: 700;
        color: #ff8c00;
        vertical-align: sub;
    }

    @media (min-width: 640px) {
        input {
            width: 75%;
            margin-left: calc(25% - 12px);
        }
    }
</style>
