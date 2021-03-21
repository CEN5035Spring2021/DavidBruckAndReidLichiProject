<script lang=ts>
    import Modal from './Modal.svelte';
    import type { IGlobalFeedback } from '../stores/globalFeedback';
    import { globalFeedback } from '../stores/globalFeedback';
    import type { Writable } from 'svelte/store';

    export let unconditionalMessage: IGlobalFeedback | undefined;
    export let showUnconditionalMessage: Writable<boolean> | undefined;

    const close = () => {
        if (!unconditionalMessage) {
            globalFeedback.update(feedback => feedback.slice(1));
        }
    };

    $:globalFeedbackLength = unconditionalMessage && showUnconditionalMessage
        ? ($showUnconditionalMessage as boolean)
        : ($globalFeedback as IGlobalFeedback[]).length;
    $:globalFeedbackFirst = unconditionalMessage
        || globalFeedbackLength
            && ($globalFeedback as IGlobalFeedback[])[0];
    $:isInformational = globalFeedbackFirst && (globalFeedbackFirst as IGlobalFeedback).isInformational;
    $:message = globalFeedbackFirst && (globalFeedbackFirst as IGlobalFeedback).message;
</script>

{ #if globalFeedbackLength }
    <Modal { close } unclosable={ !!unconditionalMessage }>
        <slot name=title slot=title>
            <h2>An error occurred:</h2>
        </slot>

        <div slot=content>
            <span class:error={ !isInformational } />
            { message }
            { #if unconditionalMessage }
                <br />
                <br />
            { :else }
                <input type=button value="Ok" on:click={ close } />
            { /if }
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

    span.error::before {
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
