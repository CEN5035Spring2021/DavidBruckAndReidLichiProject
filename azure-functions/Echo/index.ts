import type { AzureFunction, Context, HttpRequest } from '@azure/functions';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: JSON.stringify({
            query: req.query,
            body: <unknown>req.body
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    };
    return Promise.resolve();
};

export default httpTrigger;
