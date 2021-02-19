import 'expect-puppeteer';

describe('Created user is logged-in', () => {
    beforeAll(async() => {
        await page.goto('http://127.0.0.1:5000');
        const createNewUser = await page.$('button');

        await createNewUser?.click();

        const newEmailInput = await page.$('[ id="newEmail" ]');
        const newPasswordInput = await page.$('[ id="newPassword" ]');
        const confirmPasswordInput = await page.$('[ id="confirmPassword" ]');
        const createUserButtonSelector = '.modal > div > input[ type="button" ]';
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

        const emailInput = await page.$('[ id="email" ]');
        const passwordInput = await page.$('[ id="password" ]');

        await emailInput?.type(emailAddress);
        await passwordInput?.type(password);
    });

    it('Created user is logged-in', async () => {
        const loginButtonSelector = 'fieldset > input[ type="button" ]';
        const loginButton = await page.$(loginButtonSelector);

        await loginButton?.click();
        await page.waitForSelector(
            loginButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });

        await expect(page).toMatch('Logged in!');
    });
});
