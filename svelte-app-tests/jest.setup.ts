import 'expect-puppeteer';

process.on('unhandledRejection', err => fail(JSON.stringify(err, null, 2)));
process.on('uncaughtException', err => {
    console.error(err);
    process.exit(1);
});
