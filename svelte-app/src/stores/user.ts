import { writable } from 'svelte/store';

export interface IUser {
    lowercasedEmailAddress: string;
    encryptedPrivateKey: string;
    publicKey: CryptoKey;
}

export class UserStore {
    private readonly userStore: IDBObjectStore;

    private constructor(userStore: IDBObjectStore) {
        this.userStore = userStore;
    }

    public async getUser(lowercasedEmailAddress: string, next?: (user: IUser) => Promise<void>): Promise<IUser> {
        const getRequest = this.userStore.get(lowercasedEmailAddress);
        await new Promise((resolve, reject) => {
            getRequest.onsuccess = next ? () => next(getRequest.result).then(resolve).catch(reject) : resolve;
            getRequest.onerror = () => reject(getRequest.error);
        });
        return <IUser>getRequest.result;
    }

    public async putUser(user: IUser): Promise<void> {
        const putRequest = this.userStore.put(user);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }

    public static async runUnderUserStore<TState, TResult>(
        callback: (userStore: UserStore, state: TState) => Promise<TResult>,
        state?: TState
    ): Promise<TResult> {
        const db = indexedDB.open('SecureGroupMessenger');

        const storeName = 'UserStore';
        db.onupgradeneeded = () =>
            db.result.createObjectStore(storeName, {
                keyPath: 'lowercasedEmailAddress'
            });

        await new Promise((resolve, reject) => {
            db.onsuccess = resolve;
            db.onerror = () => reject(db.error);
        });

        const connection = db.result;
        const transaction = connection.transaction(storeName, 'readwrite');
        let transactionComplete: boolean;
        transaction.oncomplete = () => {
            transactionComplete = true;
            connection.close();
        };
        try {
            const objectStore = transaction.objectStore(storeName);

            return await callback(new UserStore(objectStore), state);
        } finally {
            if (!transactionComplete && typeof transaction.commit === 'function') {
                transaction.commit();
            }
        }
    }
}

export const emailAddress = writable('');
export const publicKey = writable<CryptoKey>(null);
export const privateKey = writable<CryptoKey>(null);
export function runUnderUserStore<TState, TResult>(
    callback: (userStore: UserStore, state: TState) => Promise<TResult>,
    state?: TState
): Promise<TResult>
{
    return UserStore.runUnderUserStore(callback, state);
}
