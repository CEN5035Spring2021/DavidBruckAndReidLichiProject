import type { KeyObject } from 'crypto';
import type { IUser, Signed, User } from './serverInterfaces';
import * as crypto from 'crypto';
import { getDatabase, getUsersContainer } from './database';
import type { ContainerResponse, DatabaseResponse, QueryIterator, Resource } from '@azure/cosmos';

const FIVE_MINUTES_AGO = -300000;
const FIVE_MINUTES_IN_THE_FUTURE = 300000;

type invalidSignature = { success: false; standardizedBody: string };
type validSignature<T> = { success: true; unsignedBody: T; signature: string; time: string };

export function validateSignature<T>(
    { method, url, body, signingKey } : {
        method: string;
        url: string;
        body: T & Signed;
        signingKey: KeyObject;
    }) : invalidSignature | validSignature<T> {

    if (body == null) {
        throw new Error('Missing request body');
    }
    const now = new Date().getTime();
    const time = body.time;
    const bodyTime = Date.parse(time);
    if (typeof time === 'undefined'
        || !(now - bodyTime > FIVE_MINUTES_AGO)
        || !(now - bodyTime < FIVE_MINUTES_IN_THE_FUTURE)) {
        throw new Error('Message time expired. Check system clock.');
    }

    const signature = body.signature;
    delete body.signature;

    const toVerify: T & { method: string; url: string } = {
        ...body,
        method,
        url: url.replace(/^https?:\/\//i, ''), // On Azure, req.url starts http:// even though accessed via https
        time
    };

    delete body.time;

    const standardizedBody = JSON.stringify(toVerify, Object.keys(toVerify).sort());
    if (!signature
        || !crypto
            .createVerify('RSA-SHA512')
            .update(new TextEncoder().encode(standardizedBody))
            .verify(
                {
                    key: signingKey
                },
                signature,
                'base64'))
    {
        return {
            success: false,
            standardizedBody
        };
    }

    return {
        success: true,
        unsignedBody: body,
        signature,
        time
    };
}

export function isInvalidSignature<T>(signatureResult: invalidSignature | validSignature<T>)
    : signatureResult is invalidSignature {
    return !signatureResult || !signatureResult.success;
}

export async function getValidatedUser<T extends IUser>(
    { method, url, body, database, users } : {
        method: string;
        url: string;
        body: T & Signed;
        database?: DatabaseResponse;
        users?: ContainerResponse;
    }): Promise<{
        userId: string | undefined;
        emailAddress: string | undefined;
        database: DatabaseResponse;
        users: ContainerResponse;
        time: string;
        anotherUserExistsWithSameEmailAddress: boolean;
    }> {

    if (body == null) {
        throw new Error('Missing request body');
    }
    if (!body.emailAddress) {
        throw new Error('Request body lacks emailAddress');
    }

    const ensuredDatabase = database || await getDatabase();
    const ensuredUsers = users || await getUsersContainer(ensuredDatabase);

    const LOWERCASED_EMAIL_ADDRESS_NAME = '@lowercasedEmailAddress';
    const usersReader = ensuredUsers.container.items.query({
        query: `SELECT * FROM root r WHERE r.lowercasedEmailAddress = ${LOWERCASED_EMAIL_ADDRESS_NAME}`,
        parameters: [
            {
                name: LOWERCASED_EMAIL_ADDRESS_NAME,
                value: body.emailAddress.toLowerCase()
            }
        ]
    }) as QueryIterator<User & Resource>;

    const signature = body.signature;
    const time = body.time;
    let userId: string | undefined;
    let emailAddress: string | undefined;
    let anotherUserExistsWithSameEmailAddress = false;
    do {
        const { resources } = await usersReader.fetchNext();
        if (resources.length) {
            anotherUserExistsWithSameEmailAddress = true;
            for (const user of resources) {
                // Add back original signature to make sure the existing user identifies the same
                body.signature = signature;
                body.time = time;
                if (validateSignature({
                    method,
                    url,
                    body,
                    signingKey: crypto.createPublicKey(user.signingKey)
                }).success) {
                    userId = user.id;
                    emailAddress = user.emailAddress;
                    break;
                }
            }
        }
        if (userId) {
            break;
        }
    } while (usersReader.hasMoreResults());

    return {
        userId,
        emailAddress,
        database: ensuredDatabase,
        users: ensuredUsers,
        time,
        anotherUserExistsWithSameEmailAddress
    };
}
