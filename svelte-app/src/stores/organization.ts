import { writable, get, readable } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import { showUnconditionalMessage, unconditionalMessage } from './globalFeedback';
import type { IGroup, IHasGroups } from './group';
import { selectedGroup } from './group';
import { updateGroups } from './group';
import { SettingsStore } from './settings';
import { emailAddress } from './user';

export interface IOrganization extends IHasGroups {
    name: string;
    users?: string[];
    admin?: boolean;
    groups?: IGroup[];
}

export class OrganizationStore extends Store {
    public async update({ lowercasedEmailAddress, organizations } : {
            lowercasedEmailAddress: string;
            organizations: IOrganization[];
        }): Promise<void> {
        for (const organization of organizations) {
            await this.appendImpl({
                lowercasedEmailAddress,
                organization
            });
        }
    }

    public async append(organization: IOrganization): Promise<void> {
        await this.appendImpl({
            lowercasedEmailAddress: get(emailAddress).toLowerCase(),
            organization
        });
        organizations.update(organizations => {
            organizations.push(organization.name);
            return organizations;
        });
    }

    public async get(organizationName: string): Promise<IOrganization> {
        const lowercasedEmailAddress = get(emailAddress).toLowerCase();
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        const getRequest = this._store.get(localSupportsCompositeKey
            ? [
                lowercasedEmailAddress,
                organizationName
            ]
            : `${lowercasedEmailAddress}_${organizationName}`);
        return new Promise<IOrganization>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result as IOrganization);
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    private async appendImpl({ lowercasedEmailAddress, organization } : {
        lowercasedEmailAddress: string;
        organization: IOrganization;
    }): Promise<void> {
        const nonCompositeKeyOrganization:
            Partial<IOrganization & {
                lowercasedEmailAddress_name: string;
                lowercasedEmailAddress: string;
            }> = organization;
        nonCompositeKeyOrganization.lowercasedEmailAddress = lowercasedEmailAddress;
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        if (!localSupportsCompositeKey) {
            nonCompositeKeyOrganization.lowercasedEmailAddress_name =
                `${lowercasedEmailAddress}_${organization.name}`;
        }
        const getRequest = this._store.get(localSupportsCompositeKey
            ? [
                lowercasedEmailAddress,
                organization.name
            ]
            : nonCompositeKeyOrganization.lowercasedEmailAddress_name);
        const existingOrganization = await new Promise<IOrganization>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result as IOrganization);
            getRequest.onerror = () => reject(getRequest.error);
        });

        let putRequest: IDBRequest<IDBValidKey>;
        if (existingOrganization && existingOrganization.name === organization.name) {
            updateGroups({
                organization: existingOrganization,
                groups: organization.groups
            });
            putRequest = this._store.put(existingOrganization);
        } else {
            putRequest = this._store.put(nonCompositeKeyOrganization);
        }

        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }
}

const _selectedOrganization = writable<IOrganization>(null);
export const organizations = writable<string[]>([]);
export const organizationUsers = readable<string[]>(
    [],
    set => _selectedOrganization.subscribe(value => value && set(value.users || [])));
export const organizationGroups = readable<IGroup[]>(
    [],
    set => _selectedOrganization.subscribe(value => value && set(value.groups || [])));
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

selectedOrganization.subscribe(value => {
    if (value) {
        selectedGroup.set(null);
        runUnderOrganizationStore(store => store.get(value))
            .then(organization => _selectedOrganization.set(organization))
            .catch(console.error);
    }
});
selectedGroup.subscribe(value => {
    if (value && !get(_selectedOrganization).groups?.some(group => group === value)) {
        runUnderOrganizationStore(store => store.get(get(selectedOrganization)))
            .then(organization => _selectedOrganization.set(organization))
            .catch(console.error);
    }
});
_selectedOrganization.subscribe(value => {
    const group = get(selectedGroup);
    if (value && value.groups && group) {
        const dbGroup = value.groups.find(dbGroup => dbGroup.name === group.name);
        selectedGroup.set(dbGroup);
    }
});
