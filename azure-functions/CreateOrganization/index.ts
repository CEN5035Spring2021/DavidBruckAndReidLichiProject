import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import allowSelfSignedCertificates from '../modules/allowSelfSignedCertificates';
import createCosmosClient from '../modules/createCosmosClient';
import type { Organization, OrganizationConfirmation } from '../modules/serverInterfaces';
import validateSignature from '../modules/validateSignature';
import * as crypto from 'crypto';
import type { QueryIterator } from '@azure/cosmos';
import { v4 as uuidV4 } from 'uuid';
import * as nodemailer from 'nodemailer';

interface CreateOrganizationRequest {
    name?: string,
    emailAddress?: string,
    confirmation?: string,
    encryptionKey?: string,
    signingKey?: string
}
enum CreateOrganizationResponse {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}

const DATABASE = process.env['CEN5035Spring2021Database'];
const EMAIL_INSECURE_PORT = process.env['CEN5035Spring2021bruck010InsecurePort'];
const EMAIL_FROM = process.env['CEN5035Spring2021bruck010Email'];
const EMAIL_PASSWORD = process.env['CEN5035Spring2021bruck010Password'];
const EMAIL_SMTP_SERVER = process.env['CEN5035Spring2021bruck010SmtpServer'];
const STATIC_SITE = process.env['CEN5035Spring2021StaticSite'];

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as CreateOrganizationRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }

    validateSignature<CreateOrganizationRequest>(req.body, crypto.createPublicKey(body.signingKey));

    if (!body.name) {
        throw new Error('Request body lacks name');
    }
    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }
    if (!body.encryptionKey) {
        throw new Error('Request body lacks encryptionKey');
    }

    allowSelfSignedCertificates();

    const client = createCosmosClient();

    const database = await client.databases.createIfNotExists({
        id: DATABASE
    });

    const organizationsContainer = await database.database.containers.createIfNotExists({
        id: 'Organizations',
        partitionKey: '/name',
        uniqueKeyPolicy: {
            uniqueKeys: [
                {
                    paths: [
                        '/name'
                    ]
                }
            ]
        }
    });

    const NAME_NAME = '@name';
    const organizationsReader = organizationsContainer.container.items.query({
        query: `SELECT VALUE 1 FROM root r WHERE r.name = ${NAME_NAME}`,
        parameters: [
            {
                name: NAME_NAME,
                value: body.name
            }
        ]
    }) as QueryIterator<number>;

    do {
        if ((await organizationsReader.fetchNext()).resources.length) {
            return result(CreateOrganizationResponse.AlreadyExists);
        }
    } while (organizationsReader.hasMoreResults());

    const organizationConfirmations = await database.database.containers.createIfNotExists({
        id: 'OrganizationConfirmations',
        partitionKey: '/name'
    });

    if (body.confirmation) {
        const {
            resource: organizationConfirmation
        } =
            await organizationConfirmations.container
                .item(body.confirmation, body.name)
                .read<OrganizationConfirmation>();
        if (!organizationConfirmation
            || organizationConfirmation.name !== body.name
            || organizationConfirmation.emailAddress !== body.emailAddress
            || organizationConfirmation.encryptionKey !== body.encryptionKey
            || organizationConfirmation.signingKey !== body.signingKey) {
            throw new Error('Incorrect confirmation');
        }

        const newOrganization: Organization = {
            id: uuidV4().toLowerCase(),
            name: body.name
        };
        await organizationsContainer.container.items.create(newOrganization);

        return result(CreateOrganizationResponse.Created);
    }

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
                    '<html xmlns="http://www.w3.org/1999/xhtml">\r\n'+
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

    return result(CreateOrganizationResponse.ConfirmationEmailSent);

    function result(response: CreateOrganizationResponse) : void {
        context.res = {
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};

export default httpTrigger;
