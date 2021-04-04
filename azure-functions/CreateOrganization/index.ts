import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import type {
    Organization, OrganizationConfirmation, OrganizationUser, User, IUser
} from '../modules/serverInterfaces';
import { validateSignature, getValidatedUser } from '../modules/validateSignature';
import * as crypto from 'crypto';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import {
    getOrganizationConfirmationsContainer, getOrganizationsContainer, getOrganizationUsersContainer
} from '../modules/database';

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

        if (await checkExistingOrganization({
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

        // No need to send confirmation email, we already know the user
        return createOrganization({
            context,
            body,
            name: body.name,
            organizations,
            users,
            database,
            userId,
            emailAddress
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
            organizations,
            body,
            name: organizationConfirmation.name
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
            userId,
            emailAddress: organizationConfirmation.emailAddress
        });
    }

    return createOrganizationConfirmation({
        body,
        organizationConfirmations,
        context
    });
};

async function checkExistingOrganization(
    { organizations, body, name } : {
        organizations: ContainerResponse;
        body: CreateOrganizationRequest;
        name?: string;
    }) : Promise<boolean> {

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

    let matchedExisting = false;
    do {
        const { resources } = await organizationsReader.fetchNext();
        for (const organization of resources) {
            matchedExisting = true;
            if (!name) {
                break;
            }
            if (organization.name !== name) {
                throw new Error('Request body name does not match confirmation');
            }
        }
    } while (organizationsReader.hasMoreResults());

    return matchedExisting;
}

async function createOrganization(
    { context, body, name, organizations, users, database, userId, emailAddress }: {
        context: Context;
        body: CreateOrganizationRequest;
        name: string;
        organizations: ContainerResponse;
        users: ContainerResponse;
        database: DatabaseResponse;
        userId: string | undefined;
        emailAddress: string | undefined;
    }) : Promise<void> {

    const ensuredUserId = userId ? userId : uuidV4().toLowerCase();
    if (!userId) {
        const newUser: User = {
            id: ensuredUserId,
            lowercasedEmailAddress: emailAddress.toLowerCase(),
            emailAddress,
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
        userId: ensuredUserId,
        admin: true
    };
    await organizationUsers.container.items.create(newOrganizationUser);

    result({
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
                    `@${EMAIL_SMTP_SERVER}`)
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
