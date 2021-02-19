import { setup as setupDevServer } from 'jest-dev-server';

type Config = unknown
const setupPuppeteer =
    import('jest-environment-puppeteer') as unknown as Promise<{ setup: (_: Config) => Promise<void> }>;

export default async(globalConfig: Config) : Promise<void> => {
    await setupDevServer([
        {
            command: process.env.DEBUG !== 'true'
                ? 'npm run build --prefix ../svelte-app & npm run start --prefix ../svelte-app'
                : 'npm run dev --prefix ../svelte-app',
            protocol: 'http',
            port: 5000,
            launchTimeout: 10000 // 10 seconds
        }
    ]);
    return (await setupPuppeteer).setup(globalConfig);
};
