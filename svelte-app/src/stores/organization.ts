import { writable } from 'svelte/store';
import { StoreName } from '../modules/getDatabase';
import { runUnderStore } from '../modules/runUnderDBObjectStore';

export interface IOrganization {
    name: string;
    admin?: boolean;
}

export class OrganizationStore {
    private readonly organizationStore: IDBObjectStore;

    constructor(organizationStore: IDBObjectStore) {
        this.organizationStore = organizationStore;
    }

    public async update(organizations: Array<IOrganization & { lowercasedEmailAddress: string }>): Promise<void> {
        for (const organization of organizations) {
            const putRequest = this.organizationStore.put(organization);
            await new Promise((resolve, reject) => {
                putRequest.onsuccess = resolve;
                putRequest.onerror = () => reject(putRequest.error);
            });
        }
    }
}

export const organizations = writable<IOrganization[]>([]);
export const organizationsSession = writable<string>(null);
export const confirmingOrganization = writable<boolean>(false);
export function runUnderOrganizationStore<TState, TResult>(
    callback: (organizationStore: OrganizationStore, state: TState) => Promise<TResult>,
    state?: TState
): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.OrganizationStore,
        storeConstructor: OrganizationStore,
        callback,
        state
    });
}
