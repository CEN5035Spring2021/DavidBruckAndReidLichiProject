import { writable, get, readable } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import { SettingsStore } from './settings';
import type { IOrganizationUser } from './user';
import { emailAddress } from './user';

const GREATER = 1;
const EQUALS = 0;
const LESS = -1;
const NOT_FOUND = -1;

export interface IGroup {
    name: string;
    users?: IOrganizationUser[];
    conversations?: IConversation[];
}
export interface IHasGroups {
    groups?: IGroup[];
}
export interface IConversation {
    id: string;
    users: string[];
}

export class GroupStore extends Store {
    public async append({ organizationName, group } : {
        organizationName: string;
        group: IGroup;
    }): Promise<void> {
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        const lowercasedEmailAddress = get(emailAddress).toLowerCase();

        const getRequest = this._store.get(localSupportsCompositeKey
            ? [
                lowercasedEmailAddress,
                organizationName
            ]
            : `${lowercasedEmailAddress}_${organizationName}`);
        const existingOrganization = await new Promise<{ groups?: IGroup[] }>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result as { groups?: IGroup[] });
            getRequest.onerror = () => reject(getRequest.error);
        });

        updateGroups({
            organization: existingOrganization,
            groups: [ group ]
        });

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }
    public async appendGroupUser({ organizationName, user } : {
        organizationName: string;
        user: IOrganizationUser;
    }): Promise<void> {
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        const lowercasedEmailAddress = get(emailAddress).toLowerCase();

        const getRequest = this._store.get(localSupportsCompositeKey
            ? [
                lowercasedEmailAddress,
                organizationName
            ]
            : `${lowercasedEmailAddress}_${organizationName}`);
        const existingOrganization = await new Promise<{ groups?: IGroup[] }>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result as { groups?: IGroup[] });
            getRequest.onerror = () => reject(getRequest.error);
        });

        const existingGroup = existingOrganization.groups?.find(
            existingGroup => existingGroup.name === get(selectedGroup)?.name);

        if (!existingGroup) {
            throw new Error('Could not find selected organization group by name');
        }

        updateGroupUsers({
            group: existingGroup,
            users: [ user ]
        });

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }
}
export function updateGroupUsers({ group, users } : {
    group: IGroup;
    users?: IOrganizationUser[];
}) : () => void {
    if (!users) {
        return;
    }
    if (group.users) {
        const existingUsers = new Map<string, IOrganizationUser>(
            group.users.map(user => [ user.emailAddress.toLowerCase(), user ]));
        let requiresReordering: boolean | undefined;
        for (const user of users) {
            const existingUser = existingUsers.get(user.emailAddress.toLowerCase());
            if (!existingUser) {
                group.users.push({
                    emailAddress: user.emailAddress,
                    encryptionPublicKey: user.encryptionPublicKey
                });
                requiresReordering = true;
            } else if (existingUser.encryptionPublicKey !== user.encryptionPublicKey) {
                existingUser.encryptionPublicKey = user.encryptionPublicKey;
            }
        }
        if (requiresReordering) {
            group.users.sort(
                (a, b) => a.emailAddress === b.emailAddress
                    ? EQUALS
                    : (a.emailAddress > b.emailAddress ? GREATER : LESS));
        }
    } else {
        group.users = users;
    }

    return () => {
        for (const groupUsersUpdateListener of groupUsersUpdateListeners) {
            groupUsersUpdateListener();
        }
    };
}

const groupUsersUpdateListeners: Array<() => void> = [];

export const groupUsers = readable<IOrganizationUser[]>(
    [],
    set => {
        const groupUsersUpdateListener = () => set(get(selectedGroup).users || []);
        groupUsersUpdateListeners.push(groupUsersUpdateListener);
        const unsubscribe = selectedGroup.subscribe(value => value && set(value.users || []));
        return () => {
            const groupUsersUpdateListenerIdx = groupUsersUpdateListeners.indexOf(groupUsersUpdateListener);
            if (groupUsersUpdateListenerIdx > NOT_FOUND) {
                groupUsersUpdateListeners.splice(groupUsersUpdateListenerIdx, 1);
            }
            unsubscribe();
        };
    });
export const selectedGroup = writable<IGroup>(null);
export function runUnderGroupStore<TState, TResult>(
    callback: (GroupStore: GroupStore, state: TState) => Promise<TResult>,
    state?: TState): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.OrganizationStore,
        storeConstructor: GroupStore,
        callback,
        state
    });
}
export function updateGroups({ organization, groups } : {
    organization: IHasGroups;
    groups?: IGroup[];
}): IGroup[] | undefined {
    if (!groups) {
        return;
    }
    if (!organization.groups) {
        organization.groups = groups;
        return groups;
    }

    const existingGroups = new Map(organization.groups.map(group => [ group.name, group ]));
    let requiresReordering: boolean | undefined;
    const addedGroups: IGroup[] = [];
    for (const group of groups) {
        const existingGroup = existingGroups.get(group.name);
        if (existingGroup) {
            updateGroupUsers({
                group: existingGroup,
                users: group.users
            });
        } else {
            requiresReordering = true;
            organization.groups.push(group);
            addedGroups.push(group);
        }
    }
    if (requiresReordering) {
        organization.groups.sort(
            (a, b) => a.name === b.name
                ? EQUALS
                : (a.name > b.name ? GREATER : LESS));
    }
    return addedGroups;
}
