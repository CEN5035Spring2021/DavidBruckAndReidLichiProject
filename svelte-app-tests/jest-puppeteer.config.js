// @ts-check

module.exports = {
    launch: {
        dumpio: true,
        headless: process.env.HEADLESS !== 'false',
        args: process.env.CI !== 'true'
            ? [
                '--disable-infobars'
            ]
            : [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars'
            ]
    },
    browserContext: 'default'
};
