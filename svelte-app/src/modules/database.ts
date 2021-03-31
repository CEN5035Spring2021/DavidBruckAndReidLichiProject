const INITIAL_VERSION = 1;
const ORGANIZATION_VERSION = 2;
const SETTINGS_VERSION = 3;
// Need add a higher version on every schema change
// Also, when new versions are added, change the line for `indexedDB.open` in the code inside `getDatabase()`

export enum StoreName {
    UserStore = 'UserStore',
    OrganizationStore = 'OrganizationStore',
    SettingsStore = 'SettingsStore'
}

// Microsoft Edge does not support composite keys in indexedDB. It gives DataError on <store>.put(...).
// So we must do feature detection for composite key support and use it to give an alternate behavior,
// i.e. concatenate the composite key into a single keyPath field
let _supportsCompositeKey: boolean | undefined;
export async function supportsCompositeKey(): Promise<boolean> {
    if (typeof _supportsCompositeKey !== 'undefined') {
        return _supportsCompositeKey;
    }

    const SUPPORTS_COMPOSITE_KEY = 'SupportsCompositeKey';
    const COMPOSITE_KEY_STORE = 'CompositeKeyStore';
    _supportsCompositeKey = await runUnderStore({
        storeName: COMPOSITE_KEY_STORE,
        storeConstructor: class CompositeKeyStore extends Store {
            public async supportsCompositeKey() : Promise<boolean> {
                try {
                    const putRequest = this._store.put({
                        KeyOne: '1',
                        KeyTwo: '2'
                    });
                    await new Promise((resolve, reject) => {
                        putRequest.onsuccess = resolve;
                        putRequest.onerror = () => reject(putRequest.error);
                    });
                } catch {
                    return false;
                }
                return true;
            }
        },
        callback: store => store.supportsCompositeKey(),
        overridenDatabase: () => {
            const db = indexedDB.open(SUPPORTS_COMPOSITE_KEY);
            db.onupgradeneeded = () => {
                db.result.createObjectStore(
                    COMPOSITE_KEY_STORE,
                    {
                        keyPath: [
                            'KeyOne',
                            'KeyTwo'
                        ]
                    });
            };
            return Promise.resolve(db);
        }
    });

    const deleteRequest = indexedDB.deleteDatabase(SUPPORTS_COMPOSITE_KEY);
    await new Promise((resolve, reject) => {
        deleteRequest.onsuccess = resolve;
        deleteRequest.onerror = () => reject(deleteRequest.error);
    });

    return _supportsCompositeKey;
}

export async function getDatabase() : Promise<IDBOpenDBRequest> {
    const localSupportsCompositeKey = await supportsCompositeKey();

    // When a higher version is created, it needs to be used on the following line too:
    const db = indexedDB.open('SecureGroupMessenger', SETTINGS_VERSION);

    db.onupgradeneeded = ev => {
        if (ev.oldVersion < INITIAL_VERSION) {
            db.result.createObjectStore(
                StoreName.UserStore,
                {
                    keyPath: 'lowercasedEmailAddress'
                });
        }
        if (ev.oldVersion < ORGANIZATION_VERSION) {
            db.result.createObjectStore(
                StoreName.OrganizationStore,
                {
                    keyPath: localSupportsCompositeKey
                        ? [
                            'lowercasedEmailAddress',
                            'name'
                        ]
                        : [
                            'lowercasedEmailAddress_name'
                        ]
                });
        }
        if (ev.oldVersion < SETTINGS_VERSION) {
            db.result.createObjectStore(
                StoreName.SettingsStore,
                {
                    keyPath: [
                        'name'
                    ]
                });
        }
    };

    return db;
}

export abstract class Store {
    protected readonly _store: IDBObjectStore;

    constructor(store: IDBObjectStore) {
        this._store = store;
    }
}

export async function runUnderStore<TStore extends Store, TState, TResult>(
    { storeName, storeConstructor, callback, state, overridenDatabase }: {
        storeName: string;
        options?: IDBObjectStoreParameters;
        storeConstructor: new (objectStore: IDBObjectStore) => TStore;
        callback: (store: TStore, state: TState) => Promise<TResult>;
        state?: TState;
        overridenDatabase?: () => Promise<IDBOpenDBRequest>;
    }): Promise<TResult> {

    const db = await (overridenDatabase || getDatabase)();

    await new Promise((resolve, reject) => {
        db.onsuccess = resolve;
        db.onerror = () => reject(db.error);
    });

    const connection = db.result;
    const transaction = connection.transaction(storeName, 'readwrite');
    let transactionComplete: boolean;
    const complete = new Promise<void>((resolve, reject) => {
        try {
            transaction.oncomplete = () => {
                transactionComplete = true;
                connection.close();
                resolve();
            };
        } catch (e) {
            reject(e);
        }
    });
    let result: TResult;
    try {
        const objectStore = transaction.objectStore(storeName);

        result = await callback(new storeConstructor(objectStore), state);
    } finally {
        if (!transactionComplete && typeof transaction.commit === 'function') {
            transaction.commit();
        }
    }
    await complete;
    return result;
}
