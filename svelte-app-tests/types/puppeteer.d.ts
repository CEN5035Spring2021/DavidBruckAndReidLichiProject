import { Browser, BrowserContext } from "puppeteer/lib/cjs/puppeteer/common/Browser";
import { Page } from "puppeteer/lib/cjs/puppeteer/common/Page";

declare global {
    const browser: Browser;
    const context: BrowserContext;
    const page: Page;
};
