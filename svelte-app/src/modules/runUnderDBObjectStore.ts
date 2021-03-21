import { getDatabase } from './getDatabase';

export async function runUnderStore<TStore, TState, TResult>(
    { storeName, storeConstructor, callback, state }: {
        storeName: string;
        options?: IDBObjectStoreParameters;
        storeConstructor: new (objectStore: IDBObjectStore) => TStore;
        callback: (store: TStore, state: TState) => Promise<TResult>;
        state?: TState;
    }): Promise<TResult> {

    const db = getDatabase();

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
