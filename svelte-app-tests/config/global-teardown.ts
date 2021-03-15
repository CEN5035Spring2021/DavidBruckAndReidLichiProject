import { teardown as teardownDevServer } from 'jest-dev-server';
import * as fs from 'fs';
import runCommandAsync from '../modules/runCommandAsync';
import { cosmosDBTempPath } from './global-setup';
import getElevatePrefix from '../modules/getElevatePrefix';
import { stopSMTPCoordinator } from '../modules/smtpCoordinator';
import { stopSMTPServer } from '../../dev-smtp-server/modules/smtpServer';

type Config = { [key: string]: string | undefined }
const teardownPuppeteer =
    import('jest-environment-puppeteer') as unknown as Promise<{ teardown: (_: Config) => Promise<void> }>;

export default async(globalConfig: Config) : Promise<void> => {
    await teardownDevServer();

    const ci = process.env['CI'];
    if (typeof ci === 'undefined' ? '' : ci === 'true') {
        if (typeof cosmosDBTempPath === 'string') {
            try {
                await new Promise<void>((resolve, reject) =>
                    fs.rmdir(cosmosDBTempPath, {
                        recursive: true,
                        maxRetries: 20,
                        retryDelay: 500
                    }, err => err ? reject(err) : resolve()));
            } catch (err) {
                console.error(err);
            }
        }

        for (const certLocation of [ 'My', 'Root' ]) {
            await runCommandAsync(
                getElevatePrefix() +
                `powershell "Get-ChildItem Cert:\\LocalMachine\\${certLocation} ` +
                "| ?{ $_.FriendlyName -match 'CosmosEmulatorContainerCertificate' } " +
                '| Remove-Item"');
        }
    }

    await stopSMTPServer();

    await stopSMTPCoordinator();

    return (await teardownPuppeteer).teardown(globalConfig);
};
