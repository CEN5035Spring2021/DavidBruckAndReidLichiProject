import { writable } from 'svelte/store';
import { StoreName, supportsCompositeKey, runUnderStore, Store } from '../modules/database';
import { showUnconditionalMessage, unconditionalMessage } from './globalFeedback';

export interface IOrganization {
    name: string;
    users?: string[];
    admin?: boolean;
}

export class OrganizationStore extends Store {
    public async update(organizations: Array<IOrganization & { lowercasedEmailAddress: string }>): Promise<void> {
        let tempSupportsCompositeKey: boolean | undefined;
        const ensuredSupportsCompositeKey = async() => typeof tempSupportsCompositeKey === 'undefined'
            ? tempSupportsCompositeKey = await supportsCompositeKey()
            : tempSupportsCompositeKey;
        for (const organization of organizations) {
            const nonCompositeKeyOrganization:
                Partial<IOrganization & {
                    lowercasedEmailAddress_name: string;
                    lowercasedEmailAddress: string;
                }> = organization;
            if (!await ensuredSupportsCompositeKey()) {
                nonCompositeKeyOrganization.lowercasedEmailAddress_name =
                    `${organization.lowercasedEmailAddress}_${organization.name}`;
            }
            const getRequest = this._store.get(tempSupportsCompositeKey
                ? [
                    nonCompositeKeyOrganization.lowercasedEmailAddress,
                    nonCompositeKeyOrganization.name
                ]
                : nonCompositeKeyOrganization.lowercasedEmailAddress_name);
            const existingOrganization = await new Promise<IOrganization>((resolve, reject) => {
                getRequest.onsuccess = () => resolve(getRequest.result as IOrganization);
                getRequest.onerror = () => reject(getRequest.error);
            });

            if (!existingOrganization || existingOrganization.name !== nonCompositeKeyOrganization.name) {
                const putRequest = this._store.put(nonCompositeKeyOrganization);
                await new Promise((resolve, reject) => {
                    putRequest.onsuccess = resolve;
                    putRequest.onerror = () => reject(putRequest.error);
                });
            }
        }
    }
}

export const organizations = writable<IOrganization[]>([]);
export const organizationsSession = writable<string>(null);
export const confirmingOrganization = writable<boolean>(false);
export const selectedOrganization = writable<string>(null);
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
