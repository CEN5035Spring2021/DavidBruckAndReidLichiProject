import type { KeyObject } from 'crypto';
import type { Signed } from './serverInterfaces';
import * as crypto from 'crypto';

export default function validateSignature<T>(
    body: T & Signed, signingKey: KeyObject) : false | { unsignedBody: T; signature: string } {

    if (body == null) {
        throw new Error('Missing request body');
    }

    const signature = body.signature;
    delete body.signature;

    if (!signature
        || !crypto
            .createVerify('RSA-SHA512')
            .update(new TextEncoder().encode(JSON.stringify(body, Object.keys(body).sort())))
            .verify(
                {
                    key: signingKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING
                },
                signature,
                'base64'))
    {
        return false;
    }

    return {
        unsignedBody: body,
        signature
    };
}
