import { setup as setupDevServer } from 'jest-dev-server'

const { setup: setupPuppeteer }: { setup: (_: any) => Promise<void> } =
    require('jest-environment-puppeteer');

export default async(globalConfig: any) => {
    await setupDevServer([
        {
            command: 'npm run start --prefix ../svelte-app',
            protocol: 'http',
            port: 5000,
            launchTimeout: 10000 // 10 seconds
        }
    ]);
    return setupPuppeteer(globalConfig);
};
