import { writable, get, readable } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import { showUnconditionalMessage, unconditionalMessage } from './globalFeedback';
import type { IGroup, IHasGroups } from './group';
import { updateGroupUsers } from './group';
import { selectedGroup } from './group';
import { updateGroups } from './group';
import { SettingsStore } from './settings';
import type { IOrganizationUser } from './user';
import { emailAddress } from './user';

const GREATER = 1;
const EQUALS = 0;
const LESS = -1;
const NOT_FOUND = -1;

export interface IOrganization extends IHasGroups {
    name: string;
    users?: IOrganizationUser[];
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

    public async appendGroup({ group } : {
        group: IGroup;
    }): Promise<void> {
        const existingOrganization = get(_selectedOrganization);

        updateGroups({
            organization: existingOrganization,
            groups: [ group ]
        });

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });

        for (const organizationGroupsUpdateListener of organizationGroupsUpdateListeners) {
            organizationGroupsUpdateListener();
        }
    }

    public async appendGroupUser({ user } : {
        user: IOrganizationUser;
    }): Promise<void> {
        const existingOrganization = get(_selectedOrganization);

        const existingGroup = existingOrganization.groups?.find(
            existingGroup => existingGroup.name === get(selectedGroup)?.name);

        if (!existingGroup) {
            throw new Error('Could not find selected organization group by name');
        }

        const fireGroupUsersUpdate = updateGroupUsers({
            group: existingGroup,
            users: [ user ]
        });

        updateOrganizationUsers({
            organization: existingOrganization,
            users: [ user ]
        });

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });

        for (const organizationUsersUpdateListener of organizationUsersUpdateListeners) {
            organizationUsersUpdateListener();
        }
        fireGroupUsersUpdate();
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
            updateOrganizationUsers({
                organization: existingOrganization,
                users: organization.users
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
function updateOrganizationUsers({ organization, users } : {
        organization: IOrganization;
        users?: IOrganizationUser[];
    }): void {
    if (!users) {
        return;
    }
    if (organization.users) {
        const existingUsers = new Map<string, IOrganizationUser>(
            organization.users.map(user => [ user.emailAddress, user ]));
        let requiresReordering: boolean | undefined;
        for (const user of users) {
            const existingUser = existingUsers.get(user.emailAddress.toLowerCase());
            if (existingUser) {
                existingUser.encryptionPublicKey = user.encryptionPublicKey;
            } else if (existingUser.encryptionPublicKey !== user.encryptionPublicKey) {
                organization.users.push({
                    emailAddress: user.emailAddress,
                    encryptionPublicKey: user.encryptionPublicKey
                });
                requiresReordering = true;
            }
        }
        if (requiresReordering) {
            organization.users.sort(
                (a, b) => a.emailAddress === b.emailAddress
                    ? EQUALS
                    : (a.emailAddress > b.emailAddress ? GREATER : LESS));
        }
    } else {
        organization.users = users;
    }
}

const organizationUsersUpdateListeners: Array<() => void> = [];
const organizationGroupsUpdateListeners: Array<() => void> = [];

const _selectedOrganization = writable<IOrganization>(null);
export const organizations = writable<string[]>([]);
export const organizationUsers = readable<IOrganizationUser[]>(
    [],
    set => {
        const organizationUsersUpdateListener = () => set(get(_selectedOrganization).users || []);
        organizationUsersUpdateListeners.push(organizationUsersUpdateListener);
        const unsubscribe = _selectedOrganization.subscribe(value => value && set(value.users || []));
        return () => {
            const organizationUsersUpdateListenerIdx =
                organizationUsersUpdateListeners.indexOf(organizationUsersUpdateListener);
            if (organizationUsersUpdateListenerIdx > NOT_FOUND) {
                organizationUsersUpdateListeners.splice(organizationUsersUpdateListenerIdx, 1);
            }
            unsubscribe();
        };
    });
export const organizationGroups = readable<IGroup[]>(
    [],
    set => {
        const organizationGroupsUpdateListener = () => set(get(_selectedOrganization).groups || []);
        organizationGroupsUpdateListeners.push(organizationGroupsUpdateListener);
        const unsubscribe = _selectedOrganization.subscribe(value => value && set(value.groups || []));
        return () => {
            const organizationGroupsUpdateListenerIdx =
                organizationGroupsUpdateListeners.indexOf(organizationGroupsUpdateListener);
            if (organizationGroupsUpdateListenerIdx > NOT_FOUND) {
                organizationGroupsUpdateListeners.splice(organizationGroupsUpdateListenerIdx, 1);
            }
            unsubscribe();
        };
    });
export const isOrganizationAdmin = readable<boolean>(
    false,
    set => _selectedOrganization.subscribe(value => value && set(value.admin || false)));
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
export const switchingOrganization = writable<boolean>(false);

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
        switchingOrganization.set(true);
        runUnderOrganizationStore(store => store.get(value))
            .then(organization => {
                switchingOrganization.set(false);
                _selectedOrganization.set(organization);
            })
            .catch(console.error);
    }
});
selectedGroup.subscribe(value => {
    if (value && !get(_selectedOrganization).groups?.some(group => group === value)) {
        switchingOrganization.set(true);
        runUnderOrganizationStore(store => store.get(get(selectedOrganization)))
            .then(organization => {
                switchingOrganization.set(false);
                _selectedOrganization.set(organization);
            })
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
