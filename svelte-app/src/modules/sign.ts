import OpenCrypto from 'opencrypto';
import { signingPrivateKey } from '../stores/user';
import { get } from 'svelte/store';

export interface Signed {
    signature: string;
    time: string;
}
export async function sign<T>(
    { method, url, body, crypt, signingKey } : {
        method: string;
        url: string;
        body: T;
        crypt?: OpenCrypto;
        signingKey?: CryptoKey;
    }) : Promise<T & Signed> {
    const toSign: T & { method: string; url: string; time: string } = {
        ...body,
        method,
        url,
        time: new Date().toISOString()
    };

    return {
        ...body,
        time: toSign.time,
        signature: await (crypt || new OpenCrypto()).sign(
            signingKey || get(signingPrivateKey),
            new TextEncoder().encode(JSON.stringify(toSign, Object.keys(toSign).sort())), {}) as string
    };
}
