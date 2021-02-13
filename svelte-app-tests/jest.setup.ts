import "expect-puppeteer";

process.on('unhandledRejection', err => fail(JSON.stringify(err, null, 2)));
