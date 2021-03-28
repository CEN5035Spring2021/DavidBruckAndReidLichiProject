import 'expect-puppeteer';

describe('Login with existing user', () => {
    beforeAll(async() => {
        await page.goto('http://localhost:5000');
        await page.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        const createNewUser = await page.$('button');

        await createNewUser?.click();

        const newEmailInput = await page.$('[ id="newEmail" ]');
        const newPasswordInput = await page.$('[ id="newPassword" ]');
        const confirmPasswordInput = await page.$('[ id="confirmPassword" ]');
        const createUserButtonSelector = '.modal > div > input[ type="button" ][ value="Create user" ]';
        const createUserButton = await page.$(createUserButtonSelector);
        const emailAddress = 'created-user-is-logged-in@cen.5035';
        const password = 'MyT3stP@ss';

        await newEmailInput?.type(emailAddress);
        await newPasswordInput?.type(password);
        await confirmPasswordInput?.type(password);

        await createUserButton?.click();
        await page.waitForSelector(
            createUserButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });
        await page.reload();
        await page.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        const emailInput = await page.$('[ id="email" ]');
        const passwordInput = await page.$('[ id="password" ]');

        await emailInput?.type(emailAddress);
        await passwordInput?.type(password);
    });

    it('Existing user can login', async() => {
        const loginButtonSelector = 'fieldset > input[ type="button" ]';
        const loginButton = await page.$(loginButtonSelector);

        await loginButton?.click();
        await page.waitForSelector(
            loginButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });

        await page.waitForSelector('div.organizations');
    });
});
