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
const NOT_FOUND = -1;

export class ConversationStore extends Store {
    public async append({ organizationName, groupName, conversation } : {
        organizationName: string;
        groupName: string;
        conversation: IConversation;
    }): Promise<string> {
        const localSupportsCompositeKey = await SettingsStore.supportsCompositeKey();
        const lowercasedEmailAddress = get(emailAddress).toLowerCase();

        const existingOrganizationName = get(selectedOrganization);
        if (existingOrganizationName === organizationName) {
            const existingGroup = get(organizationGroups).find(
                organizationGroup => organizationGroup.name === groupName);
            if (existingGroup) {
                const existingConversationId = appendConversation({
                    group: existingGroup,
                    conversation
                });
                if (existingConversationId) {
                    return existingConversationId;
                }
                for (const conversationsUpdateListener of conversationsUpdateListeners) {
                    conversationsUpdateListener();
                }
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

        let existingGroup = existingOrganization.groups?.find(
            organizationGroup => organizationGroup.name === groupName);

        if (existingGroup) {
            const existingConversationId = appendConversation({
                group: existingGroup,
                conversation
            });
            if (existingConversationId) {
                return existingConversationId;
            }
        } else {
            existingGroup = updateGroups({
                organization: existingOrganization,
                groups: [
                    {
                        name: groupName,
                        conversations: [
                            conversation
                        ]
                    }
                ]
            })[0];
        }

        const putRequest = this._store.put(existingOrganization);
        await new Promise((resolve, reject) => {
            putRequest.onsuccess = resolve;
            putRequest.onerror = () => reject(putRequest.error);
        });

        appendConversation({
            group: existingGroup,
            conversation
        });
    }
}

const conversationsUpdateListeners: Array<() => void> = [];

export const conversations = readable<IConversation[]>(
    [],
    set => {
        const conversationsUpdateListener = () => set(get(selectedGroup).conversations || []);
        conversationsUpdateListeners.push(conversationsUpdateListener);
        const unsubscribe = selectedGroup.subscribe(value => value && set(value?.conversations || []));
        return () => {
            const conversationsUpdateListenerIdx = conversationsUpdateListeners.indexOf(conversationsUpdateListener);
            if (conversationsUpdateListenerIdx > NOT_FOUND) {
                conversationsUpdateListeners.splice(conversationsUpdateListenerIdx, 1);
            }
            unsubscribe();
        };
    });
export const usersNotInConversation = readable<IOrganizationUser[]>(
    [],
    set => {
        const getUsersNotInConversation = (conversations?: IConversation[], users?: IOrganizationUser[]) => {
            if (!conversations || !users) {
                return users || [];
            }
            const usersInConversation = new Set(
                conversations
                    .reduce<string[]>(
                        (previousValue, currentValue) => {
                            if (currentValue.users) {
                                return [ ...previousValue, ...currentValue.users ];
                            }
                            return previousValue;
                        },
                        [])
                    .map(organizationUser => organizationUser.toLowerCase()));
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
export const selectedUsers = writable<string[]>([]);
export const conversationUsers = writable<string[]>(
    getConversationUsers(get(selectedConversation), get(selectedUsers)));
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
function getConversationUsers(selectedConversation: IConversation, selectedUsers?: string[]) {
    return selectedConversation
        ? selectedConversation.users
        : selectedUsers || [];
}

selectedGroup.subscribe(() => {
    selectedConversation.set(null);
    selectedUsers.set([]);
});
selectedConversation.subscribe(conversation => conversation && selectedUsers.set([]));
selectedUsers.subscribe(users => users.length && selectedConversation.set(null));

selectedConversation.subscribe(
    value => conversationUsers.set(getConversationUsers(value, get(selectedUsers))));
selectedUsers.subscribe(
    value => conversationUsers.set(getConversationUsers(get(selectedConversation), value)));

conversationUsers.subscribe(value => {
    if (!value.length) {
        if (get(selectedUsers).length || get(selectedConversation)) {
            selectedUsers.set([]);
            selectedConversation.set(null);
        }
        return;
    }

    const matchingConversation = get(conversations).find(
        conversation => !usersOrder({
            a: value,
            b: conversation.users,
            idx: ARRAY_START
        }));
    if (matchingConversation) {
        if (get(selectedConversation) !== matchingConversation) {
            selectedConversation.set(matchingConversation);
        }
        return;
    }

    if (get(selectedUsers) !== value) {
        selectedUsers.set(value);
    }
});

function appendConversation({ group, conversation } : {
    group: IGroup;
    conversation: IConversation;
}): string | undefined {
    const existingConversation = group.conversations?.find(
        existingConversation => existingConversation.users.length === conversation.users.length
            && existingConversation.users.every(
                (value, index) => value === conversation.users[index]));
    if (existingConversation) {
        return existingConversation.id;
    }

    if (group.conversations) {
        group.conversations.push(conversation);
        group.conversations.sort(
            (a, b) => usersOrder({
                a: a.users,
                b: b.users,
                idx: ARRAY_START
            }));
    } else {
        group.conversations = [ conversation ];
    }
}
function usersOrder(
    { a, b, idx } : {
        a: string[];
        b: string[];
        idx: number;
    }) : number {
    if (idx >= a.length) {
        return EQUALS;
    }
    const aLowercased = a[idx].toLowerCase();
    const bLowercased = b[idx].toLowerCase();
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
