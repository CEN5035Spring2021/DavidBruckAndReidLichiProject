import { writable } from 'svelte/store';

const globalFeedback = writable<string[]>([]);
export default globalFeedback;
