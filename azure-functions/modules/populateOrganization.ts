import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { getGroupUsersContainer, getOrganizationsContainer, getOrganizationUsersContainer } from './database';
import type { Group, GroupUser, Organization, OrganizationUser, User } from './serverInterfaces';

export interface OrganizationResponse {
    name?: string;
    admin?: boolean;
    users?: string[];
    groups?: GroupResponse[];
}
export interface UserResponse {
    emailAddress: string;
    encryptionPublicKey: string;
}
export interface GroupResponse {
    name: string;
    users?: string[];
}

export async function populateOrganization(
    {
        userId,
        database,
        groups,
        existingOrganizations,
        usersToOrganizations,
        usersToGroups,
        organizationUsers,
        limitToOrganization
    } : {
        userId: string;
        database: DatabaseResponse;
        groups: ContainerResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        usersToOrganizations: Map<string, string[]>;
        usersToGroups: Map<string, GroupResponse[]>;
        organizationUsers?: ContainerResponse;
        limitToOrganization?: string;
    }) : Promise<void> {
    const existingGroups = new Map<string, GroupResponse>();
    await populateOrganizationImpl({
        database,
        existingOrganizations,
        organizationUsers: organizationUsers || await getOrganizationUsersContainer(database),
        usersToOrganizations,
        groups,
        existingGroups
    });

    const groupUsers = await getGroupUsersContainer(database);
    await populateNonAdminOrganizationGroups({
        userId,
        existingOrganizations,
        groups,
        groupUsers,
        existingGroups,
        limitToOrganization
    });

    await populateGroupUsers({
        groupUsers,
        usersToGroups,
        existingGroups
    });

    // Using Order By in the database queries won't work because we query multiple collections
    // in batches so it might grab earlier-ordered organizations / users in a subsequent batch.
    // Instead, we sort everything before returning the response.
    for (const organization of existingOrganizations.values()) {
        organization.users?.sort();
        if (organization.groups) {
            organization.groups.sort((a, b) => a.name === b.name ? 0 : (a.name > b.name ? 1 : -1));
            for (const group of organization.groups) {
                group.users?.sort();
            }
        }
    }
}

export async function populateOrganizationUsers(
    { users, existingOrganizations, usersToOrganizations, usersToGroups } : {
        users: ContainerResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        usersToOrganizations: Map<string, string[]>;
        usersToGroups: Map<string, GroupResponse[]>;
    }) : Promise<UserResponse[] | undefined> {
    const userIds = new Set<string>([ ...usersToOrganizations.keys(), ...usersToGroups.keys() ]);
    if (!userIds.size) {
        return [];
    }

    const usersReader = users.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...Array(userIds.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...userIds ].map(
            ((id, userOrdinal) => ({
                name: getIdParamName(userOrdinal),
                value: id
            })))
    }) as QueryIterator<User & Resource>;

    let existingUsers: UserResponse[] | undefined;
    do {
        for (const existingUser of (await usersReader.fetchNext()).resources) {
            const organizations = usersToOrganizations.get(existingUser.id);
            if (organizations) {
                for (const organization of organizations) {
                    const existingOrganization = existingOrganizations.get(organization);
                    if (existingOrganization.users) {
                        existingOrganization.users.push(existingUser.emailAddress);
                    } else {
                        existingOrganization.users = [ existingUser.emailAddress ];
                    }
                }
            }

            const groups = usersToGroups.get(existingUser.id);
            if (groups) {
                for (const group of groups) {
                    if (group.users) {
                        group.users.push(existingUser.emailAddress);
                    } else {
                        group.users = [ existingUser.emailAddress ];
                    }
                }
            }

            const newUser: UserResponse = {
                emailAddress: existingUser.emailAddress,
                encryptionPublicKey: existingUser.encryptionKey
            };
            if (existingUsers) {
                existingUsers.push(newUser);
            } else {
                existingUsers = [ newUser ];
            }
        }
    } while (usersReader.hasMoreResults());

    // Using Order By in the database queries won't work because we query multiple collections
    // in batches so it might grab earlier-ordered organizations / users in a subsequent batch.
    // Instead, we sort everything before returning the response.
    for (const organization of existingOrganizations.values()) {
        organization.users?.sort();
    }

    existingUsers?.sort(
        (a, b) => a.emailAddress === b.emailAddress ? 0 : (a.emailAddress > b.emailAddress ? 1 : -1));

    return existingUsers;
}

export async function getExistingOrganization(
    { database, name } : {
        database: DatabaseResponse;
        name: string;
    }) : Promise<Organization & Resource | undefined> {

    const organizations = await getOrganizationsContainer(database);
    const NAME_NAME = '@name';
    const organizationsReader = organizations.container.items.query({
        query: `SELECT * FROM root r WHERE r.name = ${NAME_NAME}`,
        parameters: [
            {
                name: NAME_NAME,
                value: name
            }
        ]
    }) as QueryIterator<Organization & Resource>;

    do {
        const { resources } = await organizationsReader.fetchNext();
        for (const organization of resources) {
            return organization;
        }
    } while (organizationsReader.hasMoreResults());
}

export async function getOrganizationAdmin(
    { database, organizationId } : {
        database: DatabaseResponse;
        organizationId: string;
    }) : Promise<OrganizationUser & Resource | undefined> {

    const organizationUsers = await getOrganizationUsersContainer(database);
    const ORGANIZATION_ID_NAME = '@organizationId';
    const organizationUsersReader = organizationUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId = ${ORGANIZATION_ID_NAME} AND r.admin`,
        parameters: [
            {
                name: ORGANIZATION_ID_NAME,
                value: organizationId
            }
        ]
    }) as QueryIterator<OrganizationUser & Resource>;

    do {
        const { resources } = await organizationUsersReader.fetchNext();
        for (const organizationUser of resources) {
            return organizationUser;
        }
    } while (organizationUsersReader.hasMoreResults());
}

async function populateOrganizationImpl(
    { database, existingOrganizations, organizationUsers, usersToOrganizations, groups, existingGroups }: {
        database: DatabaseResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        organizationUsers: ContainerResponse;
        usersToOrganizations: Map<string, string[]>;
        groups: ContainerResponse;
        existingGroups: Map<string, GroupResponse>;
    }) : Promise<void> {

    if (!existingOrganizations.size) {
        return;
    }

    const organizations = await getOrganizationsContainer(database);
    const organizationsReader = organizations.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...Array(existingOrganizations.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...existingOrganizations.keys() ].map(
            ((id, organizationOrdinal) => ({
                name: getIdParamName(organizationOrdinal),
                value: id
            })))
    }) as QueryIterator<Organization & Resource>;

    do {
        for (const existingOrganization of (await organizationsReader.fetchNext()).resources) {
            existingOrganizations.get(existingOrganization.id).name = existingOrganization.name;
        }
    } while (organizationsReader.hasMoreResults());

    await populateOrganizationUsersImpl({
        existingOrganizations,
        organizationUsers,
        usersToOrganizations
    });

    await populateOrganizationGroups({
        existingOrganizations,
        groups,
        existingGroups
    });
}

async function populateOrganizationUsersImpl(
    { existingOrganizations, organizationUsers, usersToOrganizations }: {
        existingOrganizations: Map<string, OrganizationResponse>;
        organizationUsers: ContainerResponse;
        usersToOrganizations : Map<string, string[]>;
    }) : Promise<void> {

    const adminOrganizations : Map<string, OrganizationResponse> = new Map(
        [ ...existingOrganizations.entries() ]
            .filter(existingOrganization => existingOrganization[1].admin));

    if (!adminOrganizations.size) {
        return;
    }

    const organizationUsersReader = organizationUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId IN (${
            [ ...Array(adminOrganizations.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...adminOrganizations.keys() ].map(
            ((id, organizationOrdinal) => ({
                name: getIdParamName(organizationOrdinal),
                value: id
            })))
    }) as QueryIterator<OrganizationUser & Resource>;

    do {
        for (const existingOrganizationUser of (await organizationUsersReader.fetchNext()).resources) {
            let existingUsersToOrganization = usersToOrganizations.get(existingOrganizationUser.userId);
            if (!existingUsersToOrganization) {
                usersToOrganizations.set(existingOrganizationUser.userId, existingUsersToOrganization = []);
            }
            existingUsersToOrganization.push(existingOrganizationUser.organizationId);
        }
    } while (organizationUsersReader.hasMoreResults());
}

async function populateNonAdminOrganizationGroups(
    { userId, existingOrganizations, groups, groupUsers, existingGroups, limitToOrganization }: {
        userId: string;
        existingOrganizations: Map<string, OrganizationResponse>;
        groups: ContainerResponse;
        groupUsers: ContainerResponse;
        existingGroups: Map<string, GroupResponse>;
        limitToOrganization?: string;
    }) : Promise<void> {

    const nonAdminOrganizations : Map<string, OrganizationResponse> = new Map(
        [ ...existingOrganizations.entries() ]
            .filter(existingOrganization => !existingOrganization[1].admin));

    if (!nonAdminOrganizations.size) {
        return;
    }

    const USER_ID = '@userId';
    const ORGANIZATION_ID = '@organizationId';
    const queryUsersParameters = [
        {
            name: USER_ID,
            value: userId
        }
    ];
    if (limitToOrganization) {
        queryUsersParameters.push({
            name: ORGANIZATION_ID,
            value: limitToOrganization
        });
    }
    const groupUsersReader = groupUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.userId = ${USER_ID}` +
            (limitToOrganization ? ` AND r.organizationId = ${ORGANIZATION_ID}` : ''),
        parameters: queryUsersParameters
    }) as QueryIterator<GroupUser & Resource>;

    const groupIds : string[] = [];
    do {
        for (const existingGroupUser of (await groupUsersReader.fetchNext()).resources) {
            groupIds.push(existingGroupUser.groupId);
        }
    } while (groupUsersReader.hasMoreResults());

    const groupsReader = groups.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...groupIds.keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: groupIds.map(
            ((id, groupOrdinal) => ({
                name: getIdParamName(groupOrdinal),
                value: id
            })))
    }) as QueryIterator<Group & Resource>;

    do {
        for (const existingGroup of (await groupsReader.fetchNext()).resources) {
            const existingOrganization = existingOrganizations.get(existingGroup.organizationId);
            const newGroup: GroupResponse = {
                name: existingGroup.name
            };
            if (existingOrganization.groups) {
                existingOrganization.groups.push(newGroup);
            } else {
                existingOrganization.groups = [ newGroup ];
            }
            existingGroups.set(existingGroup.id, newGroup);
        }
    } while (groupsReader.hasMoreResults());
}

async function populateOrganizationGroups(
    { existingOrganizations, groups, existingGroups }: {
        existingOrganizations: Map<string, OrganizationResponse>;
        groups: ContainerResponse;
        existingGroups: Map<string, GroupResponse>;
    }) : Promise<void> {

    const adminOrganizations : Map<string, OrganizationResponse> = new Map(
        [ ...existingOrganizations.entries() ]
            .filter(existingOrganization => existingOrganization[1].admin));

    if (!adminOrganizations.size) {
        return;
    }

    const groupsReader = groups.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId IN (${
            [ ...Array(adminOrganizations.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...adminOrganizations.keys() ].map(
            ((id, organizationOrdinal) => ({
                name: getIdParamName(organizationOrdinal),
                value: id
            })))
    }) as QueryIterator<Group & Resource>;

    do {
        for (const existingGroup of (await groupsReader.fetchNext()).resources) {
            const existingOrganization = existingOrganizations.get(existingGroup.organizationId);
            const newGroup: GroupResponse = {
                name: existingGroup.name
            };
            if (existingOrganization.groups) {
                existingOrganization.groups.push(newGroup);
            } else {
                existingOrganization.groups = [ newGroup ];
            }
            existingGroups.set(existingGroup.id, newGroup);
        }
    } while (groupsReader.hasMoreResults());
}

async function populateGroupUsers(
    { groupUsers, usersToGroups, existingGroups } : {
        groupUsers: ContainerResponse;
        usersToGroups: Map<string, GroupResponse[]>;
        existingGroups: Map<string, GroupResponse>;
    }) : Promise<void> {
    if (!existingGroups.size) {
        return;
    }

    const groupUsersReader = groupUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.groupId IN (${
            [ ...Array(existingGroups.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...existingGroups.keys() ].map(
            ((id, organizationOrdinal) => ({
                name: getIdParamName(organizationOrdinal),
                value: id
            })))
    }) as QueryIterator<GroupUser & Resource>;

    do {
        for (const existingGroup of (await groupUsersReader.fetchNext()).resources) {
            const group = existingGroups.get(existingGroup.groupId);
            const userGroup = usersToGroups.get(existingGroup.userId);
            if (userGroup) {
                userGroup.push(group);
            } else {
                usersToGroups.set(existingGroup.userId, [ group ]);
            }
        }
    } while (groupUsersReader.hasMoreResults());
}

function getIdParamName(organizationOrdinal: number) {
    return `@id${organizationOrdinal}`;
}
