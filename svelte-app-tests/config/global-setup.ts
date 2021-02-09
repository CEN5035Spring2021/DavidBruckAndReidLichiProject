import { setup as setupDevServer } from 'jest-dev-server'

const { setup: setupPuppeteer }: { setup: (_: any) => Promise<void> } =
    require('jest-environment-puppeteer');

export default async(globalConfig: any) => {
    await setupDevServer([
        {
            command: 'npm run dev --prefix ../svelte-app',
            protocol: 'http',
            port: 5000
        }
    ]);
    return setupPuppeteer(globalConfig);
};
