import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type {
    Organization, OrganizationConfirmation, OrganizationUser, User, IUser
} from '../modules/serverInterfaces';
import { validateSignature, getValidatedUser } from '../modules/validateSignature';
import * as crypto from 'crypto';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import {
    getOrganizationConfirmationsContainer, getOrganizationsContainer, getOrganizationUsersContainer
} from '../modules/database';
import sendMail from '../modules/sendMail';

interface CreateOrganizationRequest extends IUser {
    name?: string;
    confirmation?: string;
    encryptionKey?: string;
    signingKey?: string;
}
interface CreateOrganizationResponse {
    type: CreateOrganizationResponseType;
    name?: string;
}
enum CreateOrganizationResponseType {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}

const EMAIL_FROM = process.env['CEN5035Spring2021bruck010Email'];
const STATIC_SITE = process.env['CEN5035Spring2021StaticSite'];

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as CreateOrganizationRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }

    const bodyValidated =
        validateSignature({
            method: req.method,
            url: req.url,
            body,
            signingKey: crypto.createPublicKey(body.signingKey)
        });
    if (typeof bodyValidated === 'boolean' || !bodyValidated) {
        throw new Error('Request body has unverified signature');
    }
    if (!body.name && !body.confirmation) {
        throw new Error('Request body lacks name');
    }
    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }
    if (!body.encryptionKey) {
        throw new Error('Request body lacks encryptionKey');
    }

    const {
        userId,
        emailAddress,
        database,
        users
    } =
        await getValidatedUser({
            method: req.method,
            url: req.url,
            body: {
                ...bodyValidated.unsignedBody,
                signature: bodyValidated.signature,
                time: bodyValidated.time
            }
        });

    const organizations = await getOrganizationsContainer(database);

    if (userId && !body.confirmation) {
        // No need to send confirmation email, we already know the user
        return ensureOrganizationUser({
            context,
            body,
            database,
            users,
            organizations,
            userId,
            emailAddress,
            organizationName: body.name
        });
    }

    const organizationConfirmations = await getOrganizationConfirmationsContainer(database);

    if (body.confirmation) {
        const {
            resource: organizationConfirmation
        } =
            await organizationConfirmations.container
                .item(body.confirmation)
                .read<OrganizationConfirmation>();
        if (!organizationConfirmation
            || organizationConfirmation.emailAddress !== body.emailAddress
            || organizationConfirmation.encryptionKey !== body.encryptionKey
            || organizationConfirmation.signingKey !== body.signingKey) {
            throw new Error('Incorrect confirmation');
        }

        return await ensureOrganizationUser({
            context,
            body,
            database,
            users,
            organizations,
            userId,
            emailAddress: organizationConfirmation.emailAddress,
            organizationName: organizationConfirmation.name
        });
    }

    return createOrganizationConfirmation({
        body,
        organizationConfirmations,
        context
    });
};

async function ensureOrganizationUser(
    { context, body, database, users, organizations, userId, emailAddress, organizationName } : {
        context: Context;
        body: CreateOrganizationRequest;
        database: DatabaseResponse;
        organizations: ContainerResponse;
        users: ContainerResponse;
        userId?: string;
        emailAddress: string;
        organizationName: string;
    }) : Promise<void> {
    const ensuredUserId = userId || await createUser({
        body,
        users,
        emailAddress
    });

    let organizationId = await getExistingOrganization({
        organizations,
        body
    });

    const organizationUsers = await getOrganizationUsersContainer(database);
    if (organizationId && await checkExistingOrganizationUser({
        organizationUsers,
        organizationId
    })) {
        return result({
            context,
            response: {
                type: CreateOrganizationResponseType.AlreadyExists
            }
        });
    }

    // No need to send confirmation email, we already know the user
    if (!organizationId) {
        organizationId = await createOrganization({
            name: organizationName,
            organizations
        });
    }

    await createOrganizationUser({
        context,
        organizationUsers,
        organizationId,
        userId: ensuredUserId,
        organizationName: organizationName
    });

    result({
        context,
        response: {
            type: CreateOrganizationResponseType.Created,
            name: organizationName
        }
    });
}

async function getExistingOrganization(
    { organizations, body, name } : {
        organizations: ContainerResponse;
        body: CreateOrganizationRequest;
        name?: string;
    }) : Promise<string> {

    const NAME_NAME = '@name';
    const organizationsReader = organizations.container.items.query({
        query: `SELECT * FROM root r WHERE r.name = ${NAME_NAME}`,
        parameters: [
            {
                name: NAME_NAME,
                value: name || body.name
            }
        ]
    }) as QueryIterator<Organization & Resource>;

    let organizationId: string | undefined;
    do {
        const { resources } = await organizationsReader.fetchNext();
        for (const organization of resources) {
            organizationId = organization.id;
            if (!name) {
                break;
            }
            if (organization.name !== name) {
                throw new Error('Request body name does not match confirmation');
            }
        }
    } while (organizationsReader.hasMoreResults());

    return organizationId;
}

async function checkExistingOrganizationUser(
    { organizationUsers, organizationId } : {
        organizationUsers: ContainerResponse;
        organizationId: string;
    }) : Promise<boolean> {
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
        if ((await organizationUsersReader.fetchNext()).resources.length) {
            return true;
        }
    } while (organizationUsersReader.hasMoreResults());

    return false;
}

async function createUser(
    { body, users, emailAddress }: {
        body: CreateOrganizationRequest;
        users: ContainerResponse;
        emailAddress: string | undefined;
    }
) : Promise<string> {
    const newUser: User = {
        id: uuidV4().toLowerCase(),
        lowercasedEmailAddress: emailAddress.toLowerCase(),
        emailAddress,
        encryptionKey: body.encryptionKey,
        signingKey: body.signingKey
    };
    await users.container.items.create(newUser);
    return newUser.id;
}

async function createOrganization(
    { name, organizations }: {
        name: string;
        organizations: ContainerResponse;
    }) : Promise<string> {
    const newOrganization: Organization = {
        id: uuidV4().toLowerCase(),
        name // Do not use name from `body.name` because OrganizationConfirmation is not requested by name
    };
    await organizations.container.items.create(newOrganization);
    return newOrganization.id;
}

async function createOrganizationUser(
    { organizationUsers, organizationId, userId } : {
        context: Context;
        organizationUsers: ContainerResponse;
        organizationId: string;
        userId: string;
        organizationName: string;
    }) : Promise<void> {
    const newOrganizationUser: OrganizationUser = {
        id: uuidV4().toLowerCase(),
        organizationId,
        userId,
        admin: true
    };
    await organizationUsers.container.items.create(newOrganizationUser);
}

async function createOrganizationConfirmation(
    { body, organizationConfirmations, context }: {
        body: CreateOrganizationRequest;
        organizationConfirmations: ContainerResponse;
        context: Context;
    }) : Promise<void> {
    const newOrganizationConfirmation: OrganizationConfirmation = {
        id: uuidV4().toLowerCase(),
        name: body.name,
        emailAddress: body.emailAddress,
        encryptionKey: body.encryptionKey,
        signingKey: body.signingKey
    };

    await organizationConfirmations.container.items.create(newOrganizationConfirmation);

    await sendMail({
        from: EMAIL_FROM,
        to: body.emailAddress,
        subject: `Finish organization creation: ${body.name}`,
        text: 'Login with your email address in the original browser to finish organization creation:\n' +
            `${STATIC_SITE}#organizationConfirmation=${newOrganizationConfirmation.id}`,
        html: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ' +
            '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\r\n' +
            '<html xmlns="http://www.w3.org/1999/xhtml">\r\n' +
            '	<head>\r\n' +
            '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n' +
            '		<meta name="viewport" content="width=device-width, initial-scale=1.0" />\r\n' +
            `		<title>Finish organization creation: ${body.name}</title>\r\n` +
            '		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n' +
            '	</head>\r\n' +
            '	<body>\r\n' +
            '		<h1>Login with your email address in the original browser to finish organization ' +
            'creation:</h1>\r\n' +
            `		<a href="${STATIC_SITE}#organizationConfirmation=` +
            `${newOrganizationConfirmation.id}">` +
            `${STATIC_SITE}#organizationConfirmation=${newOrganizationConfirmation.id}</a>\r\n` +
            '	</body>\r\n' +
            '</html>\r\n',
        textEncoding: 'quoted-printable'
    });

    result({
        context,
        response: {
            type: CreateOrganizationResponseType.ConfirmationEmailSent
        }
    });
}

function result(
    { context, response }: {
        context: Context;
        response: CreateOrganizationResponse;
    }) : void {

    context.res = {
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json'
        }
    };
}

export default httpTrigger;
