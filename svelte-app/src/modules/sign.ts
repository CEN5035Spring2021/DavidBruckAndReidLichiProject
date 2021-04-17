import OpenCrypto from 'opencrypto';
import { signingPrivateKey } from '../stores/user';
import { get } from 'svelte/store';

export interface Signed {
    signature: string;
    time: string;
}
export async function sign<T>(
    { method, url, body, crypt, signingKey, omitBody } : {
        method: string;
        url: string;
        body: T;
        crypt?: OpenCrypto;
        signingKey?: CryptoKey;
        omitBody: true;
    }) : Promise<Signed>;
export async function sign<T>(
    { method, url, body, crypt, signingKey, omitBody } : {
        method: string;
        url: string;
        body: T;
        crypt?: OpenCrypto;
        signingKey?: CryptoKey;
        omitBody: false;
    }) : Promise<T & Signed>;
export async function sign<T>(
    { method, url, body, crypt, signingKey } : {
        method: string;
        url: string;
        body: T;
        crypt?: OpenCrypto;
        signingKey?: CryptoKey;
    }) : Promise<T & Signed>;
export async function sign<T>(
    { method, url, body, crypt, signingKey, omitBody } : {
        method: string;
        url: string;
        body: T;
        crypt?: OpenCrypto;
        signingKey?: CryptoKey;
        omitBody: boolean;
    }) : Promise<Signed | T & Signed> {
    const toSign: T & { method: string; url: string; time: string } = {
        ...body,
        method,
        url: url.replace(/^https?:\/\//i, ''), // On Azure, req.url starts http:// even though accessed via https
        time: new Date().toISOString()
    };

    const signature = await (crypt || new OpenCrypto()).sign(
        signingKey || get(signingPrivateKey),
        new TextEncoder().encode(JSON.stringify(toSign, Object.keys(toSign).sort())), {}) as string;

    return omitBody
        ? {
            signature,
            time: toSign.time
        }
        : {
            ...body,
            signature,
            time: toSign.time
        };
}
