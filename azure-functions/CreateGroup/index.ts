import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type { IUser, Group } from '../modules/serverInterfaces';
import { getValidatedUser } from '../modules/validateSignature';
import type { ContainerResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import { getGroupsContainer } from '../modules/database';
import { getExistingOrganization, getOrganizationAdmin } from '../modules/populateOrganization';

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
        await getValidatedUser({
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
