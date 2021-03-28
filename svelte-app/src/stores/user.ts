import { writable } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';

export interface IUser {
    lowercasedEmailAddress: string;
    encryptedEncryptionKey: string;
    encryptedSigningKey: string;
}

export class UserStore extends Store {
    public async getUser(lowercasedEmailAddress: string, next?: (user: IUser) => Promise<void>): Promise<IUser> {
        const getRequest = this._store.get(lowercasedEmailAddress);
        await new Promise((resolve, reject) => {
            getRequest.onsuccess = next ? () => next(getRequest.result).then(resolve).catch(reject) : resolve;
            getRequest.onerror = () => reject(getRequest.error);
        });
        return getRequest.result as IUser;
    }

    public async putUser(user: IUser): Promise<void> {
        const putRequest = this._store.put(user);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }
}

export const emailAddress = writable('');
export const encryptionPrivateKey = writable<CryptoKey>(null);
export const encryptionPublicKey = writable<CryptoKey>(null);
export const signingPrivateKey = writable<CryptoKey>(null);
export const signingPublicKey = writable<CryptoKey>(null);
export const usersSession = writable<string>(null);
export function runUnderUserStore<TState, TResult>(
    callback: (userStore: UserStore, state: TState) => Promise<TResult>,
    state?: TState
): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.UserStore,
        storeConstructor: UserStore,
        callback,
        state
    });
}
