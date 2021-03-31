import { writable, get } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import { SettingsStore } from './settings';
import { emailAddress } from './user';

export interface IGroup {
    name: string;
    users?: string[];
}
export interface IHasGroups {
    groups?: IGroup[];
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

        if (!existingOrganization.groups || !existingOrganization.groups.some(
            existingGroup => existingGroup.name === group.name)) {
            (existingOrganization.groups || (existingOrganization.groups = [])).push(group);

            const putRequest = this._store.put(existingOrganization);
            await new Promise((resolve, reject) => {
                putRequest.onsuccess = resolve;
                putRequest.onerror = () => reject(putRequest.error);
            });
        }
    }
}

export const selectedGroup = writable<IGroup>(null);
export function runUnderGroupStore<TState, TResult>(
    callback: (GroupStore: GroupStore, state: TState) => Promise<TResult>,
    state?: TState
): Promise<TResult>
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
    }): void {
    if (!groups) {
        return;
    }
    if (organization.groups) {
        const existingGroups = new Map(organization.groups.map(group => [ group.name, group ]));
        for (const group of groups) {
            const existingGroup = existingGroups.get(group.name);
            if (existingGroup) {
                existingGroup.users = existingGroup.users && group.users
                    ? Array.from(new Set([ ...existingGroup.users, ...group.users ]))
                    : existingGroup.users || group.users;
            } else {
                organization.groups.push(group);
            }
        }
    } else {
        organization.groups = groups;
    }
}
