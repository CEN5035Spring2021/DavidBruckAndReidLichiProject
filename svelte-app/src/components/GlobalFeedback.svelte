<script lang=ts>
    import Modal from './Modal.svelte';
    import type { IGlobalFeedback } from '../stores/globalFeedback';
    import { globalFeedbackLength, unconditionalMessage } from '../stores/globalFeedback';
    import { globalFeedback } from '../stores/globalFeedback';

    const close = () => {
        if (!$unconditionalMessage) {
            globalFeedback.update(feedback => feedback.slice(1));
        }
    };

    $:globalFeedbackFirst = ($unconditionalMessage as IGlobalFeedback | undefined)
        || $globalFeedbackLength
            && ($globalFeedback as IGlobalFeedback[])[0];
    $:isInformational = globalFeedbackFirst && (globalFeedbackFirst as IGlobalFeedback).isInformational;
    $:title = (globalFeedbackFirst && (globalFeedbackFirst as IGlobalFeedback).title)
        || (isInformational ? 'Please wait' : 'An error occurred:');
    $:message = globalFeedbackFirst && (globalFeedbackFirst as IGlobalFeedback).message;
</script>

{ #if $globalFeedbackLength }
    <Modal { close } unclosable={ !!$unconditionalMessage }>
        <slot name=title slot=title>
            <h2>{ title }</h2>
        </slot>

        <div slot=content>
            <span class:error={ !isInformational } />
            { message }
            { #if $unconditionalMessage }
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
