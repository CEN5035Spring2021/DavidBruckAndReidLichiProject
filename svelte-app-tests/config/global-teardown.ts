import { teardown as teardownDevServer } from 'jest-dev-server'

const { teardown: teardownPuppeteer }: { teardown: (_: any) => Promise<void> } =
    require('jest-environment-puppeteer');

export default async(globalConfig: any) => {
    await teardownDevServer();
    return teardownPuppeteer(globalConfig);
};
