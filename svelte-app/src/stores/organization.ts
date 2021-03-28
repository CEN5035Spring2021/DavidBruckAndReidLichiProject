import { writable } from 'svelte/store';
import { StoreName, supportsCompositeKey, runUnderStore, Store } from '../modules/database';
import { showUnconditionalMessage, unconditionalMessage } from './globalFeedback';

export interface IOrganization {
    name: string;
    admin?: boolean;
}

export class OrganizationStore extends Store {
    public async update(organizations: Array<IOrganization & { lowercasedEmailAddress: string }>): Promise<void> {
        for (const organization of organizations) {
            const nonCompositeKeyOrganization:
                Partial<IOrganization & {
                    lowercasedEmailAddress_name: string;
                    lowercasedEmailAddress: string;
                }> = organization;
            if (!await supportsCompositeKey()) {
                nonCompositeKeyOrganization.lowercasedEmailAddress_name =
                    `${organization.lowercasedEmailAddress}_${organization.name}`;
            }
            const putRequest = this._store.put(nonCompositeKeyOrganization);
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

confirmingOrganization.subscribe(value => {
    unconditionalMessage.update(() => value
        ? {
            message: 'Confirming organization...',
            isInformational: true
        }
        : undefined);
    showUnconditionalMessage.subscribe(() => value);
});
