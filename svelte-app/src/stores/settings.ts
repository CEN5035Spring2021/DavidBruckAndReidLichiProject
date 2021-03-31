import OpenCrypto from 'opencrypto';
import { StoreName, runUnderStore, Store, supportsCompositeKey } from '../modules/database';

export interface IUser {
    lowercasedEmailAddress: string;
    encryptedEncryptionKey: string;
    encryptedSigningKey: string;
}

export class SettingsStore extends Store {
    static readonly SUPPORTS_RSA_SIGNING = 'supportsRSASigning';
    private static _supportsCompositeKey: boolean | undefined;

    public async supportsRSASigning() : Promise<{ value: boolean; persisted: boolean }> {
        try {
            const getRequest = this._store.get(SettingsStore.SUPPORTS_RSA_SIGNING) as IDBRequest<{
                name: string;
                value: boolean;
            }>;
            await new Promise((resolve, reject) => {
                getRequest.onsuccess = resolve;
                getRequest.onerror = () => reject(getRequest.error);
            });
            if (getRequest.result
                && typeof getRequest.result.name !== 'undefined') {
                return {
                    value: Boolean(getRequest.result.value),
                    persisted: true
                };
            }
            return {
                value: await SettingsStore.supportsRSASigningImpl(),
                persisted: false
            };
        } catch {
            // If there was an error reading the store, pretend the settings were persisted
            // so the implementing code does not try to store again
            return {
                value: false,
                persisted: true
            };
        }
    }

    public async persistRSASigning(value: boolean) : Promise<void> {
        const putRequest = this._store.put({
            name: SettingsStore.SUPPORTS_RSA_SIGNING,
            value
        });
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }

    public static async supportsCompositeKey() : Promise<boolean> {
        return typeof SettingsStore._supportsCompositeKey === 'undefined'
            ? SettingsStore._supportsCompositeKey = await supportsCompositeKey()
            : SettingsStore._supportsCompositeKey;
    }

    private static async supportsRSASigningImpl() : Promise<boolean> {
        try {
            const crypt = new OpenCrypto();
            const RSA_KEY_LENGTH = 4096;
            const signingKeyPair = await crypt.getRSAKeyPair(
                RSA_KEY_LENGTH,
                'SHA-512',
                'RSASSA-PKCS1-v1_5',
                [
                    'sign',
                    'verify'
                ],
                true) as { privateKey: CryptoKey };
            await crypt.sign(
                signingKeyPair.privateKey,
                new TextEncoder().encode('true'),
                {});
            return true;
        } catch {
            return false;
        }
    }
}
export function runUnderSettingsStore<TState, TResult>(
    callback: (userStore: SettingsStore, state: TState) => Promise<TResult>,
    state?: TState
): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.SettingsStore,
        storeConstructor: SettingsStore,
        callback,
        state
    });
}
