import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type { IUser, OrganizationUser } from '../modules/serverInterfaces';
import { getValidatedUser } from '../modules/validateSignature';
import type { DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { getGroupsContainer, getOrganizationUsersContainer } from '../modules/database';
import type { GroupResponse, OrganizationResponse, UserResponse } from '../modules/populateOrganization';
import { populateOrganization, populateOrganizationUsers } from '../modules/populateOrganization';

interface OrganizationsResponse {
    organizations: OrganizationResponse[];
    users?: UserResponse[];
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as IUser;
    if (body == null) {
        throw new Error('Missing request body');
    }

    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }

    const { database, users, userId } = await getValidatedUser({
        method: req.method,
        url: req.url,
        body
    });

    const existingOrganizations = new Map<string, OrganizationResponse>();
    const usersToOrganizations = new Map<string, string[]>();
    const usersToGroups = new Map<string, GroupResponse[]>();
    const organizations = await getOrganizations({
        database,
        existingOrganizations,
        userId,
        usersToOrganizations,
        usersToGroups
    });

    return result({
        context,
        response: {
            organizations,
            users: await populateOrganizationUsers({
                users,
                existingOrganizations,
                usersToOrganizations,
                usersToGroups
            })
        }
    });
};

async function getOrganizations(
    { database, existingOrganizations, userId, usersToOrganizations, usersToGroups }: {
        database: DatabaseResponse;
        existingOrganizations: Map<string, OrganizationResponse>;
        userId: string | undefined;
        usersToOrganizations: Map<string, string[]>;
        usersToGroups: Map<string, GroupResponse[]>;
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

    do {
        const { resources } = await organizationUsersReader.fetchNext();

        for (const organization of resources) {
            existingOrganizations.set(
                organization.organizationId,
                {
                    admin: organization.admin
                });
        }
    } while (organizationUsersReader.hasMoreResults());

    const groups = await getGroupsContainer(database);

    await populateOrganization({
        userId,
        database,
        groups,
        existingOrganizations,
        usersToOrganizations,
        usersToGroups,
        organizationUsers
    });

    const organizations = [ ...existingOrganizations.values() ];

    // Using Order By in the database queries won't work because we query multiple collections
    // in batches so it might grab earlier-ordered organizations / users in a subsequent batch.
    // Instead, we sort everything before returning the response.
    organizations.sort((a, b) => a.name === b.name ? 0 : (a.name > b.name ? 1 : -1));

    return organizations;
}

function result(
    { context, response }: {
        context: Context;
        response: OrganizationsResponse;
    }) : void {
    context.res = {
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json'
        }
    };
}

export default httpTrigger;
