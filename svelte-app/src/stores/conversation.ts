import { writable, get, readable } from 'svelte/store';
import { StoreName, runUnderStore, Store } from '../modules/database';
import type { IConversation, IGroup } from './group';
import { selectedGroup, groupUsers, updateGroups } from './group';
import type { IOrganization } from './organization';
import { organizationGroups, selectedOrganization } from './organization';
import { SettingsStore } from './settings';
import type { IOrganizationUser } from './user';
import { emailAddress } from './user';

const GREATER = 1;
const EQUALS = 0;
const LESS = -1;
const ARRAY_START = 0;

export class ConversationStore extends Store {
    public async append({ organizationName, groupName, conversation } : {
        organizationName: string;
        groupName: string;
        conversation: IConversation;
    }): Promise<void> {
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        const lowercasedEmailAddress = get(emailAddress).toLowerCase();

        if (get(selectedOrganization) === organizationName) {
            const existingGroup = get(organizationGroups).find(
                organizationGroup => organizationGroup.name === groupName);
            if (existingGroup && !appendConversation({
                group: existingGroup,
                conversation
            })) {
                return;
            }
        }

        const getRequest = this._store.get(localSupportsCompositeKey
            ? [
                lowercasedEmailAddress,
                organizationName
            ]
            : `${lowercasedEmailAddress}_${organizationName}`);
        const existingOrganization = await new Promise<IOrganization>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result as IOrganization);
            getRequest.onerror = () => reject(getRequest.error);
        });

        const existingGroup = existingOrganization.groups?.find(
            organizationGroup => organizationGroup.name === groupName);

        if (existingGroup) {
            if (!appendConversation({
                group: existingGroup,
                conversation
            })) {
                return;
            }
        } else {
            updateGroups({
                organization: existingOrganization,
                groups: [
                    {
                        name: groupName,
                        conversations: [
                            conversation
                        ]
                    }
                ]
            });
        }

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });
    }
}

export const conversations = readable<IConversation[]>(
    [],
    set => selectedGroup.subscribe(value => set(value?.conversations || [])));
export const usersNotInConversation = readable<IOrganizationUser[]>(
    [],
    set => {
        const getUsersNotInConversation = (conversations?: IConversation[], users?: IOrganizationUser[]) => {
            if (!conversations || !users) {
                return users || [];
            }
            const usersInConversation = new Set(
                conversations
                    .reduce<IOrganizationUser[]>(
                        (previousValue, currentValue) => {
                            if (currentValue.users) {
                                return [ ...previousValue, ...currentValue.users ];
                            }
                            return previousValue;
                        },
                        [])
                    .map(organizationUser => organizationUser.emailAddress.toLowerCase()));
            return users.filter(user => !usersInConversation.has(user.emailAddress.toLowerCase()));
        };
        const conversationsSubscription = conversations.subscribe(value =>
            set(getUsersNotInConversation(value, get(groupUsers))));
        const usersSubscription = groupUsers.subscribe(value =>
            set(getUsersNotInConversation(get(conversations), value)));
        return () => {
            conversationsSubscription();
            usersSubscription();
        };
    });
export const selectedConversation = writable<IConversation>(null);
export const selectedUser = writable<IOrganizationUser>(null);
export function runUnderConversationStore<TState, TResult>(
    callback: (ConversationStore: ConversationStore, state: TState) => Promise<TResult>,
    state?: TState): Promise<TResult>
{
    return runUnderStore({
        storeName: StoreName.OrganizationStore,
        storeConstructor: ConversationStore,
        callback,
        state
    });
}

selectedGroup.subscribe(() => {
    selectedConversation.set(null);
    selectedUser.set(null);
});
selectedConversation.subscribe(conversation => conversation && selectedUser.set(null));
selectedUser.subscribe(user => user && selectedConversation.set(null));

function appendConversation({ group, conversation } : {
    group: IGroup;
    conversation: IConversation;
}): boolean {
    if (group.conversations.some(
        existingConversation => existingConversation.users.length === conversation.users.length
            && existingConversation.users.every(
                (value, index) => value.emailAddress === conversation.users[index].emailAddress))) {
        return false;
    }

    group.conversations.push(conversation);

    group.conversations.sort(
        (a, b) => usersOrder({
            a: a.users,
            b: b.users,
            idx: ARRAY_START
        }));

    return true;
}
function usersOrder(
    { a, b, idx } : {
        a: IOrganizationUser[];
        b: IOrganizationUser[];
        idx: number;
    }) : number {
    if (idx >= a.length) {
        return EQUALS;
    }
    const aLowercased = a[idx].emailAddress.toLowerCase();
    const bLowercased = b[idx].emailAddress.toLowerCase();
    return aLowercased > bLowercased
        ? GREATER
        : (aLowercased < bLowercased
            ? LESS
            : usersOrder({
                a,
                b,
                idx: idx + 1
            }));
}
