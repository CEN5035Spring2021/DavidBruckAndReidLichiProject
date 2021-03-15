import api = require('win-ca/api');
import * as tls from 'tls';

const roots: string[] = [];
let rootsPopulated = false;
export default function allowSelfSignedCertificates(): void {
    if (!rootsPopulated) {
        api({
            save: true,
            ondata: (...items: Buffer[]) => {
                for (const item of items) {
                    roots.push(
                        '-----BEGIN CERTIFICATE-----\n' +
                        item.toString('base64').replace(/.{200}/g, '$&\n') +
                        '\n-----END CERTIFICATE-----\n');
                }
                return roots.length;
            }
        });

        const createSecureContext = tls.createSecureContext;
        (tls as { createSecureContext: (options: tls.SecureContextOptions) => tls.SecureContext }).createSecureContext =
            options => {
                if (!options.ca && roots.length) {
                    options.ca = tls.rootCertificates.concat(roots);
                }
                return createSecureContext(options);
            };

        rootsPopulated = true;
    }
}
