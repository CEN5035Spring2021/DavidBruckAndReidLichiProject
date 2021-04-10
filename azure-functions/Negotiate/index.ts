import type { AzureFunction, Context, HttpRequest } from '@azure/functions';

interface SignalRConnectionInfo {
    accessToken: string;
    url: string;
}

const httpTrigger: AzureFunction = async function(
    context: Context, _: HttpRequest, connectionInfo: SignalRConnectionInfo): Promise<void> {
    context.res = {
        body: JSON.stringify(connectionInfo),
        headers: {
            'Content-Type': 'application/json'
        }
    };
    return Promise.resolve();
};

export default httpTrigger;
