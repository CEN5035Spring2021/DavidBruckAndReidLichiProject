import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type {
    User, IUser, Group, GroupUser, GroupUserConfirmation, Organization, OrganizationUser
} from '../modules/serverInterfaces';
import { validateSignature, getValidatedUser, isInvalidSignature } from '../modules/validateSignature';
import * as crypto from 'crypto';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import {
    getGroupsContainer, getGroupUserConfirmationsContainer, getGroupUsersContainer, getDatabase, getIdParamName,
    getOrganizationUsersContainer
} from '../modules/database';
import type { GroupResponse, OrganizationResponse, UserResponse } from '../modules/populateOrganization';
import { populateOrganization, populateOrganizationUsers } from '../modules/populateOrganization';
import { getExistingOrganization, getOrganizationAdmin } from '../modules/populateOrganization';
import sendMail from '../modules/sendMail';

interface CreateGroupUserRequest extends IUser {
    groupUserEmailAddress?: string;
    organizationName?: string;
    groupName?: string;
    confirmation?: string;
    encryptionKey?: string;
    signingKey?: string;
}
interface CreateGroupUserResponse {
    type: CreateGroupUserResponseType;
    organization?: OrganizationResponse;
    users?: UserResponse[];
}
enum CreateGroupUserResponseType {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}
interface NewGroupUserMessage {
    organization: string;
    group: string;
    emailAddress?: string;
    encryptionKey?: string;
}

const EMAIL_FROM = process.env['CEN5035Spring2021bruck010Email'];
const STATIC_SITE = process.env['CEN5035Spring2021StaticSite'];

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as CreateGroupUserRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }

    return  (body.confirmation ? handleConfirmation : handleNonConfirmation)({
        context,
        body,
        req
    });
};

async function handleConfirmation(
    { context, body, req }: {
        context: Context;
        body: CreateGroupUserRequest;
        req: HttpRequest;
    }) : Promise<void> {
    const bodyValidated =
        validateSignature({
            method: req.method,
            url: req.url,
            body,
            signingKey: crypto.createPublicKey(body.signingKey)
        });
    if (isInvalidSignature(bodyValidated)) {
        throw new Error(`Request body has unverified signature:\n${bodyValidated.standardizedBody}`);
    }

    const database = await getDatabase();
    const groupUserConfirmation = await getGroupUserConfirmation({
        database,
        confirmationId: body.confirmation
    });

    const {
        userId,
        users
    } =
        await getValidatedUser({
            method: req.method,
            url: req.url,
            body: {
                ...bodyValidated.unsignedBody,
                signature: bodyValidated.signature,
                time: bodyValidated.time
            },
            database
        });

    const groupUsers = await getGroupUsersContainer(database);
    if (userId && await checkExistingGroupUsers({
        groupUsers,
        groupId: groupUserConfirmation.groupId,
        userId
    })) {
        return result({
            context,
            response: {
                type: CreateGroupUserResponseType.AlreadyExists
            }
        });
    }

    const ensuredUserId = userId || await createUser({
        users,
        body
    });

    const organizationUsers = await getOrganizationUsersContainer(database);
    if (!userId || !(await checkExistingOrganizationUser({
        organizationUsers,
        organizationId: groupUserConfirmation.organizationId,
        userId
    }))) {
        await createOrganizationUser({
            organizationUsers,
            organizationId: groupUserConfirmation.organizationId,
            userId: ensuredUserId
        });
    }

    await createGroupUser({
        groupUsers,
        organizationId: groupUserConfirmation.organizationId,
        groupId: groupUserConfirmation.groupId,
        userId: ensuredUserId
    });

    const groups = await getGroupsContainer(database);
    const existingOrganizations = new Map<string, OrganizationResponse>();
    const organization: OrganizationResponse = {};
    existingOrganizations.set(groupUserConfirmation.organizationId, organization);
    const usersToOrganizations = new Map<string, string[]>();
    const usersToGroups = new Map<string, GroupResponse[]>();

    const groupName = await populateOrganization({
        userId: ensuredUserId,
        database,
        groups,
        existingOrganizations,
        usersToOrganizations,
        usersToGroups,
        organizationUsers,
        limitToOrganization: groupUserConfirmation.organizationId,
        returnGroupNameById: groupUserConfirmation.groupId
    }) as string;

    const organizationAdmin = await getOrganizationAdmin({
        database,
        organizationId: groupUserConfirmation.organizationId,
        organizationUsers
    });

    const { adminIdx, users: userResponses } = await populateOrganizationUsers({
        users,
        existingOrganizations,
        usersToOrganizations,
        usersToGroups,
        includeAdminUser: organizationAdmin.userId
    });

    // Prepare to tell all other group users about the new user in the group
    let existingUser: UserResponse;
    const signalRUsers: string[] = [];
    const lowercasedEmailAddress = body.emailAddress.toLowerCase();
    const groupUserEmailAddresses = new Set(
        organization.groups.find(group => group.name === groupName).users.map(
            groupUserEmailAddress => groupUserEmailAddress.toLowerCase()));
    for (let userIdx = 0, usersLength = userResponses.length;
        userIdx < usersLength;
        userIdx++) {
        const userResponse = userResponses[userIdx];
        const userResponseLowercasedEmailAddress = userResponse.emailAddress.toLowerCase();
        if (!existingUser && userResponseLowercasedEmailAddress === lowercasedEmailAddress) {
            existingUser = userResponse;
        }
        if (userResponseLowercasedEmailAddress !== lowercasedEmailAddress
            && (groupUserEmailAddresses.has(userResponseLowercasedEmailAddress)
                || userIdx === adminIdx)) {
            signalRUsers.push(userResponse.emailAddress);
        }
    }

    result({
        context,
        response: {
            type: CreateGroupUserResponseType.Created,
            organization,
            users: userResponses
        },
        signalRUsers,
        signalRMessage: {
            organization: organization.name,
            group: groupName,
            emailAddress: existingUser.emailAddress,
            encryptionKey: existingUser.encryptionPublicKey
        }
    });
}

async function handleNonConfirmation(
    { context, body, req }: {
        context: Context;
        body: CreateGroupUserRequest;
        req: HttpRequest;
    }) : Promise<void> {
    const { database, users, userId } = await getValidatedUser({
        method: req.method,
        url: req.url,
        body
    });
    if (!userId) {
        throw new Error('Request body has unverified signature');
    }
    if (!body.groupUserEmailAddress) {
        throw new Error('Request body lacks groupUserEmailAddress');
    }
    if (!body.organizationName) {
        throw new Error('Request body lacks organizationName');
    }
    if (!body.groupName) {
        throw new Error('Request body lacks groupName');
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
    const group = await getExistingGroup({
        groups,
        organizationId: organization.id,
        name: body.groupName
    });

    if (!group) {
        throw new Error('Group is not part of the organization');
    }

    const user = await getExistingUser({
        users,
        emailAddress: body.groupUserEmailAddress
    });

    if (!user || !(await checkExistingOrganizationUser({
        organizationUsers: await getOrganizationUsersContainer(database),
        organizationId: organization.id,
        userId: user.id
    }))) {
        return createGroupUserConfirmation({
            context,
            database,
            organization,
            group,
            emailAddress: body.groupUserEmailAddress
        });
    }

    const groupUsers = await getGroupUsersContainer(database);
    if (await checkExistingGroupUsers({
        groupUsers,
        groupId: group.id,
        userId: user.id
    })) {
        return result({
            context,
            response: {
                type: CreateGroupUserResponseType.AlreadyExists
            }
        });
    }

    await createGroupUser({
        groupUsers,
        organizationId: organization.id,
        groupId: group.id,
        userId: user.id
    });

    const signalRUsers = await getExistingGroupUsers({
        groupUsers,
        users,
        organizationId: organization.id,
        groupId: group.id,
        excludeUserId: userId
    });

    // No need to send confirmation email, we already know the user
    result({
        context,
        response: {
            type: CreateGroupUserResponseType.Created,
            users: [
                {
                    emailAddress: user.emailAddress,
                    encryptionPublicKey: user.encryptionKey
                }
            ]
        },
        signalRUsers,
        signalRMessage: {
            organization: organization.name,
            group: body.groupName,
            emailAddress: user.emailAddress,
            encryptionKey: user.encryptionKey
        }
    });
}

async function getExistingGroupUsers(
    { groupUsers, users, organizationId, groupId, excludeUserId } : {
        groupUsers: ContainerResponse;
        users: ContainerResponse;
        organizationId: string;
        groupId: string;
        excludeUserId: string;
    }) : Promise<string[]> {
    const ORGANIZATION_ID_NAME = '@organizationId';
    const GROUP_ID_NAME = '@groupId';
    const groupUsersReader = groupUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId = ${ORGANIZATION_ID_NAME} AND r.groupId = ${GROUP_ID_NAME}`,
        parameters: [
            {
                name: ORGANIZATION_ID_NAME,
                value: organizationId
            },
            {
                name: GROUP_ID_NAME,
                value: groupId
            }
        ]
    }) as QueryIterator<GroupUser & Resource>;

    const groupUserIds: string[] = [];
    do {
        const { resources } = await groupUsersReader.fetchNext();
        for (const groupUser of resources) {
            if (groupUser.userId !== excludeUserId) {
                groupUserIds.push(groupUser.userId);
            }
        }
    } while (groupUsersReader.hasMoreResults());

    const existingGroupUsers: string[] = [];
    if (!groupUserIds.length) {
        return existingGroupUsers;
    }

    const usersReader = users.container.items.query({
        query: `SELECT * FROM root r WHERE r.id IN (${
            [ ...groupUserIds.keys() ]
                .map(getIdParamName)
                .join(',')
        })`,
        parameters: groupUserIds.map(
            ((id, userIdOrdinal) => ({
                name: getIdParamName(userIdOrdinal),
                value: id
            })))
    }) as QueryIterator<User & Resource>;

    do {
        const { resources } = await usersReader.fetchNext();
        for (const user of resources) {
            existingGroupUsers.push(user.emailAddress);
        }
    } while (usersReader.hasMoreResults());

    return existingGroupUsers;
}

async function getExistingGroup(
    { groups, organizationId, name } : {
        groups: ContainerResponse;
        organizationId: string;
        name: string;
    }) : Promise<Group & Resource | undefined> {

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
        for (const group of resources) {
            return group;
        }
    } while (groupsReader.hasMoreResults());
}

async function getExistingUser(
    { users, emailAddress } : {
        users: ContainerResponse;
        emailAddress: string;
    }) : Promise<User | undefined> {
    const LOWERCASED_EMAIL_ADDRESS_NAME = '@lowercasedEmailAddress';
    const usersReader = users.container.items.query({
        query: `SELECT * FROM root r WHERE r.lowercasedEmailAddress = ${LOWERCASED_EMAIL_ADDRESS_NAME}`,
        parameters: [
            {
                name: LOWERCASED_EMAIL_ADDRESS_NAME,
                value: emailAddress.toLowerCase()
            }
        ]
    }) as QueryIterator<User & Resource>;

    do {
        const { resources } = await usersReader.fetchNext();
        for (const user of resources) {
            return user;
        }
    } while (usersReader.hasMoreResults());
}

async function checkExistingGroupUsers(
    { groupUsers, groupId, userId } : {
        groupUsers: ContainerResponse;
        groupId: string;
        userId: string;
    }) : Promise<boolean> {
    const GROUP_ID_NAME = '@groupId';
    const USER_ID_NAME = '@userId';
    const groupUsersReader = groupUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.groupId = ${GROUP_ID_NAME} AND r.userId = ${USER_ID_NAME}`,
        parameters: [
            {
                name: GROUP_ID_NAME,
                value: groupId
            },
            {
                name: USER_ID_NAME,
                value: userId
            }
        ]
    }) as QueryIterator<GroupUser & Resource>;

    do {
        if ((await groupUsersReader.fetchNext()).resources.length) {
            return true;
        }
    } while (groupUsersReader.hasMoreResults());

    return false;
}

async function createGroupUser(
    { groupUsers, organizationId, groupId, userId } : {
        groupUsers: ContainerResponse;
        organizationId: string;
        groupId: string;
        userId: string;
    }) : Promise<void> {
    const newGroupUser: GroupUser = {
        id: uuidV4().toLowerCase(),
        organizationId,
        groupId,
        userId
    };
    await groupUsers.container.items.create(newGroupUser);
}

async function getGroupUserConfirmation(
    { database, confirmationId } : {
        database: DatabaseResponse;
        confirmationId: string;
    }) : Promise<GroupUserConfirmation> {
    const groupUserConfirmations = await getGroupUserConfirmationsContainer(database);
    const {
        resource: groupUserConfirmation
    } =
        await groupUserConfirmations.container.item(confirmationId).read<GroupUserConfirmation>();
    return groupUserConfirmation;
}

async function createUser(
    { users, body } : {
        users: ContainerResponse;
        body: CreateGroupUserRequest;
    }) : Promise<string> {

    const newUser: User = {
        id: uuidV4().toLowerCase(),
        lowercasedEmailAddress: body.emailAddress.toLowerCase(),
        emailAddress: body.emailAddress,
        encryptionKey: body.encryptionKey,
        signingKey: body.signingKey
    };
    await users.container.items.create(newUser);

    return newUser.id;
}

async function checkExistingOrganizationUser(
    { organizationUsers, organizationId, userId } : {
        organizationUsers: ContainerResponse;
        organizationId: string;
        userId: string;
    }) : Promise<boolean> {
    const ORGANIZATION_ID_NAME = '@organizationId';
    const USER_ID_NAME = '@userId';
    const organizationUsersReader = organizationUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.organizationId = ${ORGANIZATION_ID_NAME} AND r.userId = ${USER_ID_NAME}`,
        parameters: [
            {
                name: ORGANIZATION_ID_NAME,
                value: organizationId
            },
            {
                name: USER_ID_NAME,
                value: userId
            }
        ]
    }) as QueryIterator<OrganizationUser & Resource>;

    do {
        if ((await organizationUsersReader.fetchNext()).resources.length) {
            return true;
        }
    } while (organizationUsersReader.hasMoreResults());

    return false;
}

async function createOrganizationUser(
    { organizationUsers, organizationId, userId } : {
        organizationUsers: ContainerResponse;
        organizationId: string;
        userId: string;
    }) : Promise<void> {
    const newOrganizationUser: OrganizationUser = {
        id: uuidV4().toLowerCase(),
        organizationId,
        userId
    };
    await organizationUsers.container.items.create(newOrganizationUser);
}

async function createGroupUserConfirmation(
    { context, database, organization, group, emailAddress } : {
        context: Context;
        database: DatabaseResponse;
        organization: Organization;
        group: Group;
        emailAddress: string;
    }) : Promise<void> {
    const newGroupUserConfirmation: GroupUserConfirmation = {
        id: uuidV4().toLowerCase(),
        organizationId: organization.id,
        groupId: group.id,
        lowercasedEmailAddress: emailAddress.toLowerCase()
    };

    const groupUserConfirmations = await getGroupUserConfirmationsContainer(database);

    await groupUserConfirmations.container.items.create(newGroupUserConfirmation);

    await sendMail({
        from: EMAIL_FROM,
        to: emailAddress,
        subject: `Finish group user creation: ${organization.name}\\${group.name}`,
        text: 'Login with your email address in the original browser to finish group user creation:\n' +
            `${STATIC_SITE}#emailAddress=${encodeURIComponent(emailAddress)}` +
            `&groupUserConfirmation=${newGroupUserConfirmation.id}`,
        html: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ' +
            '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\r\n' +
            '<html xmlns="http://www.w3.org/1999/xhtml">\r\n' +
            '	<head>\r\n' +
            '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n' +
            '		<meta name="viewport" content="width=device-width, initial-scale=1.0" />\r\n' +
            `		<title>Finish group user creation: ${organization.name}\\${group.name}</title>\r\n` +
            '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n' +
            '	</head>\r\n' +
            '	<body>\r\n' +
            '		<h1>Login with your email address in the original browser to finish group user ' +
            'creation:</h1>\r\n' +
            `		<a href="${STATIC_SITE}#emailAddress=${encodeURIComponent(emailAddress)}` +
            `&groupUserConfirmation=${newGroupUserConfirmation.id}">` +
            `${STATIC_SITE}#emailAddress=${encodeURIComponent(emailAddress)}` +
            `&groupUserConfirmation=${newGroupUserConfirmation.id}</a>\r\n` +
            '	</body>\r\n' +
            '</html>\r\n',
        textEncoding: 'quoted-printable'
    });

    result({
        context,
        response: {
            type: CreateGroupUserResponseType.ConfirmationEmailSent
        }
    });
}

function result(
    { context, response, signalRUsers, signalRMessage }: {
        context: Context;
        response: CreateGroupUserResponse;
        signalRUsers?: string[];
        signalRMessage?: NewGroupUserMessage;
    }) : void {

    context.res = {
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (signalRUsers) {
        context.bindings.signalRMessages = signalRUsers.map(
            signalRUser => ({
                userId: signalRUser,
                target: 'newGroupUser',
                arguments: [
                    signalRMessage
                ]
            }));
    }
}

export default httpTrigger;
