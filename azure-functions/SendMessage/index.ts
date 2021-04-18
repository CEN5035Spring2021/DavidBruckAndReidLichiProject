import type { ItemResponse, Resource } from '@azure/cosmos';
import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { getMessagesContainer } from '../modules/database';
import type { GroupResponse } from '../modules/populateOrganization';
import {
    getExistingGroup, getExistingOrganization, populateGroupUsers, forEachUser
} from '../modules/populateOrganization';
import type { IUser, Message, User } from '../modules/serverInterfaces';
import { getValidatedUser } from '../modules/validateSignature';
import { v4 as uuidV4 } from 'uuid';
import { encodeMsClientPrincipalName } from '../modules/signalR';

interface SendMessageRequest extends IUser {
    organization?: string;
    group?: string;
    userMessages?: IUserMessage[];
    encryptedMessage?: string;
}
interface IUserMessage {
    emailAddress?: string;
    encryptedKey?: string;
}
enum SendMessageResponse {
    Sent = 'Sent'
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as SendMessageRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }
    if (!body.organization) {
        throw new Error('Request body lacks organization');
    }
    if (!body.group) {
        throw new Error('Request body lacks group');
    }
    if (!body.userMessages || !body.userMessages.length) {
        throw new Error('Request body lacks userMessages');
    }
    if (!body.encryptedMessage) {
        throw new Error('Request body lacks encryptedMessage');
    }
    const userMessages = new Map<string, string>();
    const signalRUsers: string[] = [];
    for (const userMessage of body.userMessages) {
        if (!userMessage.emailAddress) {
            throw new Error('Request body has an element in userMessages without emailAddress');
        }
        if (!userMessage.encryptedKey) {
            throw new Error('Request body has an element in userMessages without encryptedKey');
        }
        userMessages.set(userMessage.emailAddress.toLowerCase(), userMessage.encryptedKey);
        signalRUsers.push(userMessage.emailAddress.toLowerCase());
    }

    const { database, users, userId, time } = await getValidatedUser({
        method: req.method,
        url: req.url,
        body
    });
    if (!userId) {
        throw new Error('Request body has unverified signature');
    }

    const existingOrganization = await getExistingOrganization({
        database,
        name: body.organization
    });
    if (!existingOrganization) {
        throw new Error('Organization not found by requested name');
    }

    const existingGroup = await getExistingGroup({
        database,
        organizationId: existingOrganization.id,
        name: body.group
    });
    if (!existingGroup) {
        throw new Error('Group not found within the organization, both by requested names');
    }

    const group: GroupResponse = {
        name: existingGroup.name
    };
    const usersToGroups = new Map<string, GroupResponse[]>();
    await populateGroupUsers({
        database,
        usersToGroups,
        existingGroups: new Map<string, GroupResponse>([
            [
                existingGroup.id,
                group
            ]
        ])
    });

    const existingUsers: Array<User & Resource> = [];
    await forEachUser({
        users,
        userIds: usersToGroups,
        callback: existingUser => existingUsers.push(existingUser)
    });

    const usersLowercasedEmailAddressesToIds = new Map<string, string>(
        existingUsers.map(existingUser => [
            existingUser.lowercasedEmailAddress,
            existingUser.id
        ]));
    const senderId = usersLowercasedEmailAddressesToIds.get(body.emailAddress.toLowerCase());
    if (!senderId) {
        throw new Error('User is not in the group in the organization, both by requested names');
    }
    for (const userMessage of userMessages) {
        if (!usersLowercasedEmailAddressesToIds.has(userMessage[0])) {
            throw new Error(
                'Request body has an element in userMessages which does not correspond to a user in the group in the ' +
                'organization, both by requested names');
        }
    }

    const messages = await getMessagesContainer(database);
    const lowercasedBodyUserMessages = body.userMessages.map(
        userMessage => userMessage.emailAddress.toLowerCase());
    const messagePromises: Array<Promise<ItemResponse<Message>>> = [];
    for (const userMessage of userMessages) {
        const newMessage: Message = {
            id: uuidV4(),
            organizationId: existingOrganization.id,
            groupId: existingGroup.id,
            userId: usersLowercasedEmailAddressesToIds.get(userMessage[0]),
            otherUserIds: lowercasedBodyUserMessages
                .filter(otherUserEmailAddress => userMessage[0] !== otherUserEmailAddress)
                .map(userEmailAddress => usersLowercasedEmailAddressesToIds.get(userEmailAddress))
                .concat(senderId),
            senderId,
            encryptedMessage: body.encryptedMessage,
            encryptedKey: userMessage[1],
            date: time
        };
        messagePromises.push(
            messages.container.items.create(newMessage));
    }
    for (const messagePromise of messagePromises) {
        await messagePromise;
    }

    context.res = {
        body: JSON.stringify(SendMessageResponse.Sent),
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (signalRUsers) {
        context.bindings.signalRMessages = signalRUsers.map(
            signalRUser => ({
                userId: encodeMsClientPrincipalName(signalRUser),
                target: 'newMessage',
                arguments: []
            }));
    }
};

export default httpTrigger;
