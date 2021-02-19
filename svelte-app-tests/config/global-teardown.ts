import { teardown as teardownDevServer } from 'jest-dev-server';

type Config = unknown
const teardownPuppeteer =
    import('jest-environment-puppeteer') as unknown as Promise<{ teardown: (_: Config) => Promise<void> }>;

export default async(globalConfig: Config) : Promise<void> => {
    await teardownDevServer();
    return (await teardownPuppeteer).teardown(globalConfig);
};
