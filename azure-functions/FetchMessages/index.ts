import type { DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import {
    getGroupsContainer, getIdParamName, getMessagesContainer, getOrganizationsContainer
} from '../modules/database';
import { forEachUser } from '../modules/populateOrganization';
import type { Group, IUser, Message, Organization } from '../modules/serverInterfaces';
import { getValidatedUser } from '../modules/validateSignature';

interface FetchMessagesResponse {
    messages?: MessageResponse[];
}
interface MessageResponse {
    messageId: string;
    organization: string;
    group: string;
    users: string[];
    sender: string;
    encryptedMessage: string;
    encryptedKey: string;
    date: string;
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as IUser;
    if (body == null) {
        throw new Error('Missing request body');
    }
    const { database, users, userId } = await getValidatedUser({
        method: req.method,
        url: req.url,
        body
    });
    if (!userId) {
        throw new Error('Request body has unverified signature');
    }

    const existingMessages = await getMessages({
        database,
        userId
    });
    if (!existingMessages.length) {
        const response: FetchMessagesResponse = {};
        context.res = {
            body: response,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        return;
    }

    const organizationIds = new Set<string>(existingMessages.map(
        existingMessage => existingMessage.organizationId));
    const existingOrganizations = await getExistingOrganizations({
        database,
        organizationIds
    });

    const groupsIdsByOrganizationId = new Map<string, string[]>();
    for (const existingMessage of existingMessages) {
        const groupIds = groupsIdsByOrganizationId.get(existingMessage.organizationId);
        if (groupIds) {
            groupIds.push(existingMessage.groupId);
        } else {
            groupsIdsByOrganizationId.set(existingMessage.organizationId, [ existingMessage.groupId ]);
        }
    }
    const existingGroups = await getExistingGroups({
        database,
        groupsIdsByOrganizationId
    });

    const existingUsers = new Map<string, string>();
    await forEachUser({
        users,
        userIds: existingMessages.reduce(
            (previousValue, currentValue) => {
                for (const userId of currentValue.otherUserIds) {
                    previousValue.add(userId);
                }
                return previousValue;
            },
            new Set<string>()),
        callback: existingUser => existingUsers.set(existingUser.id, existingUser.emailAddress)
    });

    const response: FetchMessagesResponse = {
        messages: existingMessages.map(existingMessage => ({
            messageId: existingMessage.id,
            organization: existingOrganizations.get(existingMessage.organizationId),
            group: existingGroups.get(existingMessage.groupId),
            users: existingMessage.otherUserIds.map(otherUserId => existingUsers.get(otherUserId)),
            sender: existingUsers.get(existingMessage.senderId),
            encryptedMessage: existingMessage.encryptedMessage,
            encryptedKey: existingMessage.encryptedKey,
            date: existingMessage.date
        }))
    };
    context.res = {
        body: response,
        headers: {
            'Content-Type': 'application/json'
        }
    };
};
async function getMessages(
    { userId, database } : {
        userId: string;
        database: DatabaseResponse;
    }) : Promise<Message[]> {

    const messages = await getMessagesContainer(database);
    const USER_ID_NAME = '@userId';
    const messagesReader = messages.container.items.query({
        query: `SELECT * FROM root r WHERE r.userId = ${USER_ID_NAME}`,
        parameters: [
            {
                name: USER_ID_NAME,
                value: userId
            }
        ]
    }) as QueryIterator<Message & Resource>;

    const existingMessages: Message[] = [];
    do {
        const { resources } = await messagesReader.fetchNext();
        for (const message of resources) {
            existingMessages.push(message);
        }
    } while (messagesReader.hasMoreResults());
    return existingMessages;
}

async function getExistingOrganizations(
    { database, organizationIds } : {
        database: DatabaseResponse;
        organizationIds: Set<string>;
    }) : Promise<Map<string, string>> {

    const organizations = await getOrganizationsContainer(database);
    const organizationsReader = organizations.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...new Array(organizationIds.size).keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: [ ...organizationIds.keys() ].map(
            ((id, organizationOrdinal) => ({
                name: getIdParamName(organizationOrdinal),
                value: id
            })))
    }) as QueryIterator<Organization & Resource>;

    const existingOrganizations = new Map<string, string>();
    do {
        const { resources } = await organizationsReader.fetchNext();
        for (const organization of resources) {
            existingOrganizations.set(organization.id, organization.name);
        }
    } while (organizationsReader.hasMoreResults());
    return existingOrganizations;
}

async function getExistingGroups(
    { database, groupsIdsByOrganizationId } : {
        database: DatabaseResponse;
        groupsIdsByOrganizationId: Map<string, string[]>;
    }) : Promise<Map<string, string>> {

    const ORGANIZATION_ID = '@organizationId';
    const groups = await getGroupsContainer(database);
    const existingGroups = new Map<string, string>();

    for (const [ organizationId, groupIds ] of groupsIdsByOrganizationId.entries()) {
        const groupsReader = groups.container.items.query({
            query: `SELECT * FROM root r WHERE r.organizationId = ${ORGANIZATION_ID} AND r.id IN (${
                [ ...groupIds.keys() ]
                    .map(getIdParamName)
                    .join(',')
            })`,
            parameters: groupIds.map(
                ((id, organizationOrdinal) => ({
                    name: getIdParamName(organizationOrdinal),
                    value: id
                }))).concat(
                {
                    name: ORGANIZATION_ID,
                    value: organizationId
                })
        }) as QueryIterator<Group & Resource>;

        do {
            const { resources } = await groupsReader.fetchNext();
            for (const group of resources) {
                existingGroups.set(group.id, group.name);
            }
        } while (groupsReader.hasMoreResults());
    }

    return existingGroups;
}

export default httpTrigger;
