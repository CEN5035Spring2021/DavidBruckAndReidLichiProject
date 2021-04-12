import type { Readable } from 'svelte/store';
import { get, readable, writable } from 'svelte/store';

export const globalFeedback = writable<IGlobalFeedback[]>([]);
export const unconditionalMessage = writable<IGlobalFeedback>(undefined);
export const showUnconditionalMessage = writable<boolean>(undefined);
export const globalFeedbackLength = readable<number | boolean>(
    globalFeedbackLengthImpl({
        unconditionalMessage: get(unconditionalMessage),
        showUnconditionalMessage: get(showUnconditionalMessage),
        globalFeedback: get(globalFeedback)
    }),
    set => {
        unconditionalMessage.subscribe(value => set(globalFeedbackLengthImpl({
            unconditionalMessage: value,
            showUnconditionalMessage: get(showUnconditionalMessage),
            globalFeedback: get(globalFeedback)
        })));
        showUnconditionalMessage.subscribe(value => set(globalFeedbackLengthImpl({
            unconditionalMessage: get(unconditionalMessage),
            showUnconditionalMessage: value,
            globalFeedback: get(globalFeedback)
        })));
        globalFeedback.subscribe(value => set(globalFeedbackLengthImpl({
            unconditionalMessage: get(unconditionalMessage),
            showUnconditionalMessage: get(showUnconditionalMessage),
            globalFeedback: value
        })));
    });
export function subscribePleaseWait(value: Readable<boolean>, message: string): () => void {
    return value.subscribe(value => {
        if (value || message === get(unconditionalMessage)?.message) {
            unconditionalMessage.set(
                value
                    ? {
                        message,
                        isInformational: true
                    }
                    : undefined);
            showUnconditionalMessage.set(value);
        }
    });
}

function globalFeedbackLengthImpl({ unconditionalMessage, showUnconditionalMessage, globalFeedback } : {
    unconditionalMessage: IGlobalFeedback | undefined;
    showUnconditionalMessage: boolean | undefined;
    globalFeedback: IGlobalFeedback[];
}) : number | boolean {
    return unconditionalMessage && typeof showUnconditionalMessage !== 'undefined'
        ? showUnconditionalMessage
        : globalFeedback.length;
}

export interface IGlobalFeedback {
    message: string;
    isInformational?: boolean;
    title?: string;
}
