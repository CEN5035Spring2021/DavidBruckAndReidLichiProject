import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type { Organization, OrganizationUser, IUser, Group } from '../modules/serverInterfaces';
import { getExistingUser } from '../modules/validateSignature';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import { getOrganizationsContainer, getOrganizationUsersContainer, getGroupsContainer } from '../modules/database';

interface CreateGroupRequest extends IUser {
    name?: string;
    organizationName?: string;
}
enum CreateGroupResponse {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created'
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as CreateGroupRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }

    const {
        userId,
        database
    } =
        await getExistingUser({
            method: req.method,
            url: req.url,
            body
        });

    if (!userId) {
        throw new Error('Request body has unverified signature');
    }
    if (!body.name) {
        throw new Error('Request body lacks name');
    }
    if (!body.organizationName) {
        throw new Error('Request body lacks organizationName');
    }

    const organization = await getExistingOrganization({
        database,
        name: body.organizationName
    });

    const organizationAdmin = await getOrganizationAdmin({
        database,
        organizationId: organization.id
    });

    if (userId !== organizationAdmin.userId) {
        throw new Error('User is not the admin of the organization');
    }

    const groups = await getGroupsContainer(database);

    if (await checkExistingGroup({
        groups,
        organizationId: organization.id,
        name: body.name
    })) {
        return result({
            context,
            response: CreateGroupResponse.AlreadyExists
        });
    }

    return createGroup({
        context,
        groups,
        organizationId: organization.id,
        name: body.name
    });
};

async function getExistingOrganization(
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

async function getOrganizationAdmin(
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

async function checkExistingGroup(
    { groups, organizationId, name } : {
        groups: ContainerResponse;
        organizationId: string;
        name: string;
    }) : Promise<boolean> {

    const ORGANIZATION_ID_NAME = '@organizationId';
    const NAME_NAME = '@name';
    const groupsReader = groups.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId = ${ORGANIZATION_ID_NAME} AND r.name = ${NAME_NAME}`,
        parameters: [
            {
                name: ORGANIZATION_ID_NAME,
                value: organizationId
            },
            {
                name: NAME_NAME,
                value: name
            }
        ]
    }) as QueryIterator<Group & Resource>;

    do {
        const { resources } = await groupsReader.fetchNext();
        if (resources.length) {
            return true;
        }
    } while (groupsReader.hasMoreResults());
    return false;
}

async function createGroup(
    { context, groups, organizationId, name } : {
        context: Context;
        groups: ContainerResponse;
        organizationId: string;
        name: string;
    }) : Promise<void> {

    const newGroup: Group = {
        id: uuidV4().toLowerCase(),
        organizationId,
        name
    };
    await groups.container.items.create(newGroup);

    result({
        context,
        response: CreateGroupResponse.Created
    });
}

function result(
    { context, response }: {
        context: Context;
        response: CreateGroupResponse;
    }) : void {

    context.res = {
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json'
        }
    };
}

export default httpTrigger;
