import 'expect-puppeteer';
import type { JestDevServerOptions } from 'jest-dev-server';
import { setup as setupDevServer } from 'jest-dev-server';
import * as path from 'path';
import { v4 as uuidV4 } from 'uuid';
import runCommandAsync from '../modules/runCommandAsync';
import * as crypto from 'crypto';
import * as fs from 'fs';
import getElevatePrefix from '../modules/getElevatePrefix';
import cleanDatabase from '../modules/cleanDatabase';
import * as chalk from 'chalk';
import { onEmailReceived } from '../modules/smtpHandlers';
import { startSMTPServer } from '../../dev-smtp-server/modules/smtpServer';
import { startSMTPCoordinator } from '../modules/smtpCoordinator';
import * as jwt from 'jsonwebtoken';

type Config = { [key: string]: string | undefined }
const setupPuppeteer =
    import('jest-environment-puppeteer') as unknown as Promise<{ setup: (_: Config) => Promise<void> }>;

export declare let cosmosDBTempPath: string;
export default async(globalConfig: Config) : Promise<void> => {
    const ci = process.env['CI'];
    const serversStarted = {
        started: false
    };
    const servers: JestDevServerOptions[] = [];

    const localAppData = process.env['LOCALAPPDATA'];
    const isCI = typeof ci === 'undefined' ? '' : ci === 'true';

    const localSettingsJson = path.join(
        // We are in <Git_root>/svelte-app-tests/config/global-setup.ts,
        // need to resolve to <Git_root>/azure-functions/local.settings.json(.sample)
        path.resolve(__dirname, '..', '..'),
        'azure-functions',
        'local.settings.json');
    if (!fs.existsSync(localSettingsJson)
        && fs.existsSync(`${localSettingsJson}.sample`)) {
        fs.copyFileSync(`${localSettingsJson}.sample`, localSettingsJson);
    }

    if (isCI) {
        cosmosDBTempPath = path.join(
            typeof localAppData === 'undefined' ? '' : localAppData,
            `CosmosDB-${uuidV4()}`);

        await new Promise<void>((resolve, reject) => fs.mkdir(
            cosmosDBTempPath,
            err => err ? reject(err) : resolve()));

        const cosmosExists = await runCommandAsync(
            'docker inspect --type=image mcr.microsoft.com/cosmosdb/winsrv2019/azure-cosmos-emulator',
            {
                errorCodeToResponses: {
                    1: false
                }
            });

        if (!cosmosExists) {
            await runCommandAsync(
                'docker pull mcr.microsoft.com/cosmosdb/winsrv2019/azure-cosmos-emulator',
                {
                    verbose: true
                });
        }

        servers.push(
            {
                command: 'powershell docker run --name azure-cosmosdb-emulator --rm --memory 2GB -v ' +
                    `${cosmosDBTempPath}:C:\\CosmosDB.Emulator\\bind-mount ` +
                    '-p 8081:8081 -p 8900:8900 -p 8901:8901 -p 8902:8902 -p 10250:10250 -p 10251:10251 ' +
                    '-p 10252:10252 -p 10253:10253 -p 10254:10254 -p 10255:10255 -p 10256:10256 -p 10350:10350 ' +
                    '-i mcr.microsoft.com/cosmosdb/winsrv2019/azure-cosmos-emulator',
                protocol: 'https',
                port: 8081,
                launchTimeout: 60000, // 60 seconds
                waitOnScheme: {
                    strictSSL: false,
                    headers: getCosmosDBAuthorizationHeaders()
                },
                serversStarted
            },
            getSignalRServer(serversStarted, isCI));
    } else {
        const signalRExists = await runCommandAsync(
            'asrs-emulator',
            {
                errorCodeToResponses: {
                    1: false
                }
            });

        if (signalRExists) {
            servers.push(getSignalRServer(serversStarted, isCI));
        } else {
            servers.push({
                command: 'echo Install dotnet tool Microsoft.Azure.SignalR.Emulator.&&' +
                    'echo The following command can be used to install the emulator:&&' +
                    'echo dotnet tool install -g Microsoft.Azure.SignalR.Emulator --version 1.0.0-preview1-10723&&' +
                    'echo https://localhost:8088/&&timeout 10', // 10 seconds
                protocol: 'https',
                port: 8088,
                usedPortAction: 'ignore',
                waitOnScheme: {
                    strictSSL: false,
                    headers: getCosmosDBAuthorizationHeaders()
                },
                serversStarted
            });
        }

        servers.push({
            command: 'echo Ensure Azure Cosmos emulator is running.&&' +
                'echo The following command can be used to start the emulator&&' +
                'echo (requires Docker setup to use Windows containers):&&' +
                'echo powershell md -Force $env:LOCALAPPDATA\\CosmosDB-Emulator ^&^& ' +
                'powershell docker run --name azure-cosmosdb-emulator --rm --memory 2GB -v ' +
                '$env:LOCALAPPDATA\\CosmosDB-Emulator:C:\\CosmosDB.Emulator\\bind-mount -p 8081:8081 -p 8900:8900 ' +
                '-p 8901:8901 -p 8902:8902 -p 10250:10250 -p 10251:10251 -p 10252:10252 -p 10253:10253 ' +
                '-p 10254:10254 -p 10255:10255 -p 10256:10256 -p 10350:10350 -d ' +
                '-it mcr.microsoft.com/cosmosdb/windows/azure-cosmos-emulator&&echo.&&' +
                'echo You can tell when the emulator is ready by watching for a file to appear at path:&&' +
                `echo ${typeof localAppData === 'undefined' ? '' : localAppData}\\CosmosDB-Emulator\\` +
                'importcert.ps1&&echo Run the file as Administrator to import its certificates, and test by ' +
                'using a browser and navigating to:&&echo https://localhost:8081/&&timeout 10', // 10 seconds
            protocol: 'https',
            port: 8081,
            usedPortAction: 'ignore',
            waitOnScheme: {
                strictSSL: false,
                headers: getCosmosDBAuthorizationHeaders()
            },
            serversStarted
        });
    }

    servers.push(
        {
            command: process.env.DEBUG !== 'true'
                ? 'npm run build:production --prefix ../azure-functions' +
                    ' && npm run start:host --prefix ../azure-functions'
                : 'npm run prestart --prefix ../azure-functions && npm run start:host --prefix ../azure-functions',
            protocol: 'http',
            port: 7071,
            launchTimeout: 30000 + (isCI ? 60000 : 0), // 30 seconds (plus more for GitHub Actions)
            serversStarted
        },
        {
            command: process.env.DEBUG !== 'true'
                ? 'npm run build --prefix ../svelte-app && npm run start --prefix ../svelte-app'
                : 'npm run dev --prefix ../svelte-app',
            protocol: 'http',
            port: 5000,
            launchTimeout: 60000 + (isCI ? 60000 : 0), // 60 seconds (plus more for GitHub Actions)
            serversStarted
        });

    try {
        await setupDevServer(servers);
    } catch (e) {
        const err = e as { message: string; stack: string } | null;
        console.error(chalk.red(
            `\n${err && err.message || err as unknown as string}\n` +
            ((err && err.stack) ? `${err.stack}\n` : '')));
        throw new Error('Failed to start dev servers prior to starting tests!');
    }
    serversStarted.started = true;

    if (isCI) {
        // Cleanup certificates before installing new ones.
        // This is more reliable than cleaning up certificates in global-teardown.ts, but we'll still try both
        for (const certLocation of [ 'My', 'Root' ]) {
            await runCommandAsync(
                getElevatePrefix() +
                `powershell "Get-ChildItem Cert:\\LocalMachine\\${certLocation} ` +
                "| ?{ $_.FriendlyName -match 'CosmosEmulatorContainerCertificate' } " +
                '| Remove-Item"');
        }
        const importCertificatesWithRetries = async(retries = 10) => {
            await runCommandAsync(
                getElevatePrefix() +
                `powershell -ExecutionPolicy Bypass "${cosmosDBTempPath}\\importcert.ps1"`);
            let certMissing;
            for (const certLocation of [ 'My', 'Root' ]) {
                if (!await runCommandAsync(
                    getElevatePrefix() +
                        `powershell "Get-ChildItem Cert:\\LocalMachine\\${certLocation} ` +
                        "| ?{ $_.FriendlyName -match 'CosmosEmulatorContainerCertificate' } " +
                        '| measure | foreach { If (`$_.Count -eq 0) { exit 1 } }"',
                    {
                        errorCodeToResponses: {
                            1: false
                        }
                    })) {
                    certMissing = true;
                    break;
                }
            }
            if (!certMissing) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            await importCertificatesWithRetries(retries - 1);
        };
        await importCertificatesWithRetries();
    }

    await cleanDatabase();

    await startSMTPServer(onEmailReceived);

    await startSMTPCoordinator();

    return (await setupPuppeteer).setup(globalConfig);
};

function getCosmosDBAuthorizationHeaders() {
    const utcDate = new Date().toUTCString();
    return {
        'x-ms-date': utcDate,
        'x-ms-version': '2018-12-31',
        Authorization: encodeURIComponent(
            'type=master&ver=1.0&sig=' +
            crypto
                .createHmac(
                    'sha256',
                    Buffer.from(
                        'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
                        'base64'))
                .update(Buffer.from(
                    `head\n\n\n${utcDate.toLowerCase()}\n\n`))
                .digest('base64'))
    };
}
function getSignalRServer(
    serversStarted: {
        started: boolean;
    },
    isCI: boolean | ''): JestDevServerOptions {
    return {
        command: 'asrs-emulator start -p 8088',
        protocol: 'http',
        port: 8088,
        launchTimeout: 30000 + (isCI ? 60000 : 0), // 30 seconds (plus more for GitHub Actions)
        serversStarted,
        waitOnScheme: {
            headers: getSignalRAuthorizationHeader()
        },
        path: '/api/v1/health'
    };
}
function getSignalRAuthorizationHeader() {
    return {
        Authorization: 'Bearer ' +
            jwt.sign(
                {
                    aud: 'http://localhost:8088/api/v1/health'
                },
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGH')
    };
}
