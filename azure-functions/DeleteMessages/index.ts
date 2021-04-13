import type { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { getMessagesContainer } from '../modules/database';
import type { IUser } from '../modules/serverInterfaces';
import { getValidatedUser } from '../modules/validateSignature';

interface DeleteMessagesRequest extends IUser {
    messages?: string[];
}
enum DeleteMessagesResponse {
    Deleted = 'Deleted'
}

const httpTrigger: AzureFunction = async function(context: Context, req: HttpRequest): Promise<void> {
    const body = req.body as DeleteMessagesRequest;
    if (body == null) {
        throw new Error('Missing request body');
    }
    const { database, userId } = await getValidatedUser({
        method: req.method,
        url: req.url,
        body
    });
    if (!userId) {
        throw new Error('Request body has unverified signature');
    }
    if (!body.messages || !body.messages.length) {
        throw new Error('Request body lacks messages');
    }

    const messages = await getMessagesContainer(database);
    for (const message of body?.messages) {
        await messages.container.item(message, userId).delete();
    }

    context.res = {
        body: JSON.stringify(DeleteMessagesResponse.Deleted),
        headers: {
            'Content-Type': 'application/json'
        }
    };
};

export default httpTrigger;
