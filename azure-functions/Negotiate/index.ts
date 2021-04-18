import type { QueryIterator, Resource } from '@azure/cosmos';
import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { getDatabase, getUsersContainer } from '../modules/database';
import type { Signed, User } from '../modules/serverInterfaces';
import { decodeMsClientPrincipalName } from '../modules/signalR';
import { getValidatedUser } from '../modules/validateSignature';

interface NegotiateResponse {
    type: NegotiateResponseType;
    connectionInfo?: SignalRConnectionInfo;
}
enum NegotiateResponseType {
    Success = 'Success',
    UserAlreadyExists = 'UserAlreadyExists'
}
interface SignalRConnectionInfo {
    accessToken: string;
    url: string;
}

const httpTrigger: AzureFunction = async function(
    context: Context, req: HttpRequest, connectionInfo: SignalRConnectionInfo): Promise<void> {

    const emailAddress = decodeMsClientPrincipalName(req.headers['x-ms-client-principal-name']);

    const body = req.body as Signed;
    if (body && body.signature) {
        const { userId, anotherUserExistsWithSameEmailAddress } = await getValidatedUser({
            method: req.method,
            url: req.url,
            body: {
                emailAddress,
                ...body
            }
        });
        if (!userId && anotherUserExistsWithSameEmailAddress) {
            return result({
                context,
                body: {
                    type: NegotiateResponseType.UserAlreadyExists
                }
            });
        }
    } else {
        const database = await getDatabase();
        const users = await getUsersContainer(database);

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

        let anotherUserExistsWithSameEmailAddress = false;
        do {
            const { resources } = await usersReader.fetchNext();
            if (resources.length) {
                anotherUserExistsWithSameEmailAddress = true;
                break;
            }
        } while (usersReader.hasMoreResults());

        if (anotherUserExistsWithSameEmailAddress) {
            return result({
                context,
                body: {
                    type: NegotiateResponseType.UserAlreadyExists
                }
            });
        }
    }

    return result({
        context,
        body: {
            type: NegotiateResponseType.Success,
            connectionInfo
        }
    });
};

function result(
    { context, body } : {
        context: Context;
        body: NegotiateResponse;
    }) {

    context.res = {
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json'
        }
    };
}

export default httpTrigger;
