import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type {
    Organization, OrganizationConfirmation, OrganizationUser, Signed, User
} from '../modules/serverInterfaces';
import validateSignature from '../modules/validateSignature';
import * as crypto from 'crypto';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import {
    getDatabase, getOrganizationConfirmationsContainer, getOrganizationsContainer, getOrganizationUsersContainer,
    getUsersContainer
} from '../modules/database';

interface CreateOrganizationRequest {
    name?: string;
    emailAddress?: string;
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

const EMAIL_INSECURE_PORT = process.env['CEN5035Spring2021bruck010InsecurePort'];
const EMAIL_FROM = process.env['CEN5035Spring2021bruck010Email'];
const EMAIL_PASSWORD = process.env['CEN5035Spring2021bruck010Password'];
const EMAIL_SMTP_SERVER = process.env['CEN5035Spring2021bruck010SmtpServer'];
const STATIC_SITE = process.env['CEN5035Spring2021StaticSite'];

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as CreateOrganizationRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }

    const bodyValidated =
        validateSignature<CreateOrganizationRequest>(req.body, crypto.createPublicKey(body.signingKey));
    if (!bodyValidated) {
        throw new Error('Request body has unverified signature');
    }
    const { signature } = bodyValidated;
    if (!body.name && !body.confirmation) {
        throw new Error('Request body lacks name');
    }
    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }
    if (!body.encryptionKey) {
        throw new Error('Request body lacks encryptionKey');
    }

    const database = await getDatabase();

    const organizations = await getOrganizationsContainer(database);

    const {
        matchedExistingUserId,
        users
    } =
        await checkExistingUser({
            database,
            body,
            signature
        });

    if (matchedExistingUserId
        && !body.confirmation) {

        if (await checkExistingOrganization({
            name: body.name,
            organizations
        })) {
            return result({
                context,
                response: {
                    type: CreateOrganizationResponseType.AlreadyExists
                }
            });
        }

        // No need to send confirmation email, we already know the user
        return createOrganization({
            context,
            body,
            name: body.name,
            organizations,
            users,
            database,
            matchedExistingUserId
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

        if (await checkExistingOrganization({
            name: organizationConfirmation.name,
            organizations,
            body
        })) {
            return result({
                context,
                response: {
                    type: CreateOrganizationResponseType.AlreadyExists
                }
            });
        }

        return createOrganization({
            context,
            body,
            name: organizationConfirmation.name,
            organizations,
            users,
            database,
            matchedExistingUserId
        });
    }

    return createOrganizationConfirmation({
        body,
        organizationConfirmations,
        context
    });
};

async function checkExistingOrganization(
    { name, organizations, body } : {
        name: string;
        organizations: ContainerResponse;
        body?: CreateOrganizationRequest;
    }) : Promise<boolean> {

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

    let matchedExisting = false;
    do {
        const {
            resources
        } =
            await organizationsReader.fetchNext();
        for (const organization of resources) {
            matchedExisting = true;
            if (!body || !body.name) {
                break;
            }
            if (organization.name !== body.name) {
                throw new Error('Request body name does not match confirmation');
            }
        }
    } while (organizationsReader.hasMoreResults());

    return matchedExisting;
}

async function checkExistingUser(
    { database, body, signature } : {
        database: DatabaseResponse;
        body: CreateOrganizationRequest & Signed;
        signature: string;
    }): Promise<{
        matchedExistingUserId?: string;
        users: ContainerResponse;
    }> {
    const users = await getUsersContainer(database);

    const EMAIL_ADDRESS_NAME = '@emailAddress';
    const usersReader = users.container.items.query({
        query: `SELECT * FROM root r WHERE r.emailAddress = ${EMAIL_ADDRESS_NAME}`,
        parameters: [
            {
                name: EMAIL_ADDRESS_NAME,
                value: body.emailAddress
            }
        ]
    }) as QueryIterator<User & Resource>;

    let matchedExistingUserId: string | undefined;
    do {
        const {
            resources: existingUsers
        } =
            await usersReader.fetchNext();
        if (existingUsers.length) {
            for (const user of existingUsers) {
                matchedExistingUserId = user.id;

                // Add back original signature to make sure the existing user identifies the same
                body.signature = signature;
                if (!validateSignature(body, crypto.createPublicKey(user.signingKey))) {
                    throw new Error('Request body has unverified signature');
                }
            }
        }
    } while (usersReader.hasMoreResults());

    return {
        matchedExistingUserId,
        users
    };
}

async function createOrganization(
    { context, body, name, organizations, users, database, matchedExistingUserId }: {
        context: Context;
        body: CreateOrganizationRequest;
        name: string;
        organizations: ContainerResponse;
        users: ContainerResponse;
        database: DatabaseResponse;
        matchedExistingUserId: string | undefined;
    }) : Promise<void> {

    const userId = matchedExistingUserId ? matchedExistingUserId : uuidV4().toLowerCase();
    if (!matchedExistingUserId) {
        const newUser: User = {
            id: userId,
            emailAddress: body.emailAddress,
            encryptionKey: body.encryptionKey,
            signingKey: body.signingKey
        };
        await users.container.items.create(newUser);
    }

    const newOrganization: Organization = {
        id: uuidV4().toLowerCase(),
        name // Do not use name from `body.name` because OrganizationConfirmation is not requested by name
    };
    await organizations.container.items.create(newOrganization);

    const organizationUsers = await getOrganizationUsersContainer(database);

    const newOrganizationUser: OrganizationUser = {
        id: uuidV4().toLowerCase(),
        organizationId: newOrganization.id,
        userId,
        admin: true
    };
    await organizationUsers.container.items.create(newOrganizationUser);

    return result({
        context,
        response: {
            type: CreateOrganizationResponseType.Created,
            name
        }
    });
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

    await nodemailer
        .createTransport(
            EMAIL_INSECURE_PORT
                ? {
                    host: EMAIL_SMTP_SERVER,
                    port: Number(EMAIL_INSECURE_PORT),
                    secure: false,
                    ignoreTLS: true,
                    auth: {
                        user: EMAIL_FROM,
                        pass: EMAIL_PASSWORD
                    }
                }
                : `smtps://${encodeURIComponent(EMAIL_FROM)}:${encodeURIComponent(EMAIL_PASSWORD)}` +
                    `@${EMAIL_SMTP_SERVER}#organizationConfirmation=${newOrganizationConfirmation.id}`)
        .sendMail(
            {
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

    await organizationConfirmations.container.items.create(newOrganizationConfirmation);

    return result({
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
