import { writable } from 'svelte/store';

export const globalFeedback = writable<IGlobalFeedback[]>([]);
export interface IGlobalFeedback {
    message: string;
    isInformational?: boolean;
}
