import 'expect-puppeteer';
import * as path from 'path';
import * as fs from 'fs';

process.on('unhandledRejection', err => fail(JSON.stringify(err, null, 2)));
process.on('uncaughtException', err => {
    console.error(err);
    process.exit(1);
});

const FAILURE_SCREENSHOTS = 'failure_screenshots';
const failureScreenshotsDir = path.join(
    __dirname,
    FAILURE_SCREENSHOTS);

if (fs.existsSync(failureScreenshotsDir)) {
    for (const existingScreenshot of fs.readdirSync(failureScreenshotsDir)) {
        const existingScreeshotFullPath = path.resolve(failureScreenshotsDir, existingScreenshot);
        if (fs.lstatSync(existingScreeshotFullPath).isFile()) {
            fs.unlinkSync(existingScreeshotFullPath);
        }
    }
}

const takeScreenshot = async() => {
    const testPath = expect.getState().testPath;
    await new Promise<void>(
        (resolve, reject) => fs.mkdir(
            path.join(failureScreenshotsDir),
            {
                recursive: true
            },
            err => err ? reject(err) : resolve()));
    await page.screenshot({
        path: path.join(
            failureScreenshotsDir,
            `${path.basename(testPath).slice(0, 0 - path.extname(testPath).length)}.png`)
    });
};
// // Multiple screenshot version below, but the browser is shared with multiple tests,
// // so the pages captured might include other tests than the failing one, best used with
// // Jest option --runInBand
//
// const takeScreenshot = async() => {
//     const testPath = expect.getState().testPath;
//     await new Promise<void>(
//         (resolve, reject) => fs.mkdir(
//             path.join(failureScreenshotsDir),
//             {
//                 recursive: true
//             },
//             err => err ? reject(err) : resolve()));
//     const screenshotBasePath = path.join(
//         failureScreenshotsDir,
//         path.basename(testPath).slice(0, 0 - path.extname(testPath).length));
//     for (const [ pageIdx, browserPage ] of (await browser.pages()).entries()) {
//         await browserPage.screenshot({
//             path: `${screenshotBasePath}_${pageIdx}.png`
//         });
//     }
// };

let screenshotPromise = Promise.resolve();
beforeEach(() => screenshotPromise);
afterAll(() => screenshotPromise);

const environmentGetter: { getEnv(): jasmine.Env } = jasmine;
const addReporterGetter =
    (envi: jasmine.Env) => (envi as { addReporter(reporter: jasmine.Reporter | jasmine.CustomReporter) : void })
        .addReporter.bind(envi);
const specDoneReporter: jasmine.CustomReporter = {
    specDone: (result: { status?: string }) => {
        if (result.status === 'failed') {
            screenshotPromise = screenshotPromise
                .catch()
                .then(() => takeScreenshot());
        }
    }
};
addReporterGetter(environmentGetter.getEnv())(specDoneReporter);
