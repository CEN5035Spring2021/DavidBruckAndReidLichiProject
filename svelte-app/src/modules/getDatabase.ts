const INITIAL_VERSION = 1;
const ORGANIZATION_VERSION = 2;
// Need add a higher version on every schema change

export function getDatabase() : IDBOpenDBRequest {
    // When a higher version is created, it needs to be used on the following line too:
    const db = indexedDB.open('SecureGroupMessenger', ORGANIZATION_VERSION);

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
                    keyPath: [
                        'lowercasedEmailAddress',
                        'name'
                    ]
                });
        }
    };

    return db;
}
export enum StoreName {
    UserStore = 'UserStore',
    OrganizationStore = 'OrganizationStore'
}
