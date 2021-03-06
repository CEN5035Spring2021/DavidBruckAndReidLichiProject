import { encodeMsClientPrincipalName } from './encodeMsClientPrincipalName';

const READY = 4; // XHR Ready
const OK = 200; // HTTP status

export function api<T>(
    { method, url, body, xMsClientPrincipalName } : {
        method: string;
        url: string;
        body?: unknown;
        xMsClientPrincipalName?: string;
    }) : Promise<T> {
    const MAX_RETRIES = 5;
    const BASE_DELAY_MILLISECONDS = 100;
    const EXPONENTIAL_BASE = 3; // Final delay: 3^5 * 100ms = 24.3sec
    const apiWithRetries : (retries?: number) => Promise<T> = async(retries = MAX_RETRIES) => {
        const {
            response,
            status,
            responseText
        } =
            await new Promise<{ response?: T; status: number; responseText?: string }>(
                resolve => {
                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (this.readyState !== READY) {
                            return;
                        }

                        if (this.status === OK) {
                            resolve({
                                response: JSON.parse(this.responseText) as T,
                                status: this.status
                            });
                        } else {
                            resolve({
                                status: this.status,
                                responseText: this.responseText
                            });
                        }
                    };
                    xhr.open(method, url);
                    if (xMsClientPrincipalName) {
                        xhr.setRequestHeader(
                            'x-ms-client-principal-name',
                            encodeMsClientPrincipalName(xMsClientPrincipalName));
                    }
                    xhr.send(body && JSON.stringify(body));
                });

        if (status === OK) {
            return response;
        }
        if (!retries) {
            throw new Error(`Server error ${status} ${responseText}`);
        }
        await new Promise(resolve => setTimeout(
            resolve,
            Math.pow(EXPONENTIAL_BASE, MAX_RETRIES - retries + 1) * BASE_DELAY_MILLISECONDS));
        return apiWithRetries(retries - 1);
    };
    return apiWithRetries();
}
