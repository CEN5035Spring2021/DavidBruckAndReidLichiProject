import { writable, get } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import { selectedConversation } from './conversation';
import type { IGlobalFeedback } from './globalFeedback';
import { globalFeedback, showUnconditionalMessage, unconditionalMessage } from './globalFeedback';
import type { IConversation } from './group';

const STRING_START = 0;

export interface IMessage {
    messageId: string;
    encryptedMessage: string;
    encryptedKey: string;
    sender: string;
    conversationId: string;
    date: string;
}

export class MessagesStore extends Store {
    public async append(message: IMessage): Promise<void> {
        const getExistingMessage = this._store.get(message.messageId) as IDBRequest<IMessage>;
        const existingMessage = await new Promise((resolve, reject) => {
            getExistingMessage.onsuccess = () => resolve(getExistingMessage.result);
            getExistingMessage.onerror = () => reject(getExistingMessage.error);
        });

        if (existingMessage) {
            return;
        }

        const putRequest = this._store.put(message);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });

        if (message.conversationId === get(selectedConversation)?.id) {
            messages.update(value => [ ...value, message ]);
        }
    }

    public async get(conversation: IConversation): Promise<IMessage[]> {
        if (!conversation) {
            return [];
        }
        const index = this._store.index('conversationId');
        const indexRange = IDBKeyRange.bound(
            [
                // Starting at the exact UUID (inclusive)
                conversation.id
            ],
            [
                // Going up to conversationId + 1, before the next UUID (exclusive)
                // 0-9 -> 1-:
                // a-f -> b-g
                // Works because a > :
                conversation.id.substr(STRING_START, conversation.id.length - 1) +
                    String.fromCharCode(conversation.id.charCodeAt(conversation.id.length - 1) + 1)
            ],
            false,
            true);
        const cursor = index.openCursor(indexRange);

        const messages: IMessage[] = [];
        return new Promise<IMessage[]>((resolve, reject) => {
            cursor.onerror = () => reject(cursor.error);
            cursor.onsuccess = () => {
                const result = cursor.result;
                if (result) {
                    messages.push(result.value as IMessage);
                    result.continue();
                } else {
                    resolve(messages);
                }
            };
        });
    }
}
export const messages = writable<IMessage[]>([]);
const switchingConversation = writable<boolean>(false);
const decryptingConversationMessage: IGlobalFeedback = {
    message: 'Decrypting conversation...',
    isInformational: true
};
switchingConversation.subscribe(value => {
    if (value || get(unconditionalMessage) === decryptingConversationMessage) {
        unconditionalMessage.set(value ? decryptingConversationMessage : undefined);
        showUnconditionalMessage.set(value);
    }
});
selectedConversation.subscribe(value => {
    switchingConversation.set(true);
    runUnderMessagesStore(async(store) => {
        messages.set(await store.get(value));
        switchingConversation.set(false);
    }).catch(reason => {
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in runUnderMessagesStore: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]);
        switchingConversation.set(false);
    });
});
export function runUnderMessagesStore<TState, TResult>(
    callback: (messagesStore: MessagesStore, state: TState) => Promise<TResult>,
    state?: TState): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.MessagesStore,
        storeConstructor: MessagesStore,
        callback,
        state
    });
}
