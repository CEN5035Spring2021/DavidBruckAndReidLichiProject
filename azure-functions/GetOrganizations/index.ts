import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type { IUser, Organization, OrganizationUser, User } from '../modules/serverInterfaces';
import { getExistingUser } from '../modules/validateSignature';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { getOrganizationsContainer, getOrganizationUsersContainer } from '../modules/database';

export interface OrganizationsResponse {
    organizations: OrganizationResponse[];
}
export interface OrganizationResponse {
    name?: string;
    admin?: boolean;
    users?: string[];
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as IUser;
    if (body == null) {
        throw new Error('Missing request body');
    }

    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }

    return result({
        context,
        organizations: await getOrganizations(
            await getExistingUser({
                method: req.method,
                url: req.url,
                body
            }))
    });
};

async function getOrganizations(
    { database, users, userId }: {
        database: DatabaseResponse;
        users: ContainerResponse;
        userId: string | undefined;
    }) : Promise<OrganizationResponse[]> {

    const USER_ID = '@userId';
    const organizationUsers = await getOrganizationUsersContainer(database);
    const organizationUsersReader = organizationUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.userId = ${USER_ID}`,
        parameters: [
            {
                name: USER_ID,
                value: userId
            }
        ]
    }) as QueryIterator<OrganizationUser & Resource>;

    const organizations: OrganizationResponse[] = [];
    do {
        const { resources } = await organizationUsersReader.fetchNext();

        const existingOrganizations : Map<string, OrganizationResponse> = new Map(
            resources.map(organization => [
                organization.organizationId,
                {
                    admin: organization.admin
                }
            ]));

        await populateOrganization({ database, users, existingOrganizations, organizationUsers });

        organizations.push(...existingOrganizations.values());
    } while (organizationUsersReader.hasMoreResults());

    // Using Order By in the database queries won't work because we query multiple collections
    // in batches so it might grab earlier-ordered organizations / users in a subsequent batch
    organizations.sort((a, b) => a.name === b.name ? 0 : (a.name > b.name ? 1 : -1));
    for (const organization of organizations) {
        organization.users?.sort();
    }

    return organizations;
}

async function populateOrganization(
    { database, users, existingOrganizations, organizationUsers }: {
        database: DatabaseResponse;
        users: ContainerResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        organizationUsers: ContainerResponse;
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

    await populateOrganizationUsers({
        users,
        existingOrganizations,
        organizationUsers
    });
}

async function populateOrganizationUsers(
    { users, existingOrganizations, organizationUsers }: {
        users: ContainerResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        organizationUsers: ContainerResponse;
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

    const usersToOrganizations = new Map<string, string[]>();
    do {
        const fetchLog = async() => {
            const next = await organizationUsersReader.fetchNext();
            return next;
        };
        for (const existingOrganizationUser of (await fetchLog()).resources) {
            let existingUsersToOrganization = usersToOrganizations.get(existingOrganizationUser.userId);
            if (!existingUsersToOrganization) {
                usersToOrganizations.set(existingOrganizationUser.userId, existingUsersToOrganization = []);
            }
            existingUsersToOrganization.push(existingOrganizationUser.organizationId);
        }
    } while (organizationUsersReader.hasMoreResults());

    await populateUsers({
        users,
        existingOrganizations,
        usersToOrganizations
    });
}

async function populateUsers(
    { users, existingOrganizations, usersToOrganizations }: {
        users: ContainerResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        usersToOrganizations: Map<string, string[]>;
    }) : Promise<void> {

    if (!usersToOrganizations.size) {
        return;
    }

    const usersReader = users.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...Array(usersToOrganizations.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...usersToOrganizations.keys() ].map(
            ((id, userOrdinal) => ({
                name: getIdParamName(userOrdinal),
                value: id
            })))
    }) as QueryIterator<User & Resource>;

    do {
        for (const existingUser of (await usersReader.fetchNext()).resources) {
            for (const organizationId of usersToOrganizations.get(existingUser.id)) {
                const existingOrganization = existingOrganizations.get(organizationId);
                if (existingOrganization.users) {
                    existingOrganization.users.push(existingUser.emailAddress);
                } else {
                    existingOrganization.users = [ existingUser.emailAddress ];
                }
            }
        }
    } while (usersReader.hasMoreResults());
}

function getIdParamName(organizationOrdinal: number) {
    return `@id${organizationOrdinal}`;
}

function result(
    { context, organizations }: {
        context: Context;
        organizations: OrganizationResponse[];
    }) : void {
    const response: OrganizationsResponse = {
        organizations
    };
    context.res = {
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json'
        }
    };
}

export default httpTrigger;
