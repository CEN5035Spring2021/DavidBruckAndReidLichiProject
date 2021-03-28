import 'expect-puppeteer';

describe('New user loads with empty inputs for email and password', () => {
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
    });

    it('Modal fields are all correct', async() => {
        const header = await page.$('.modal > h2');
        const emailLabel = await page.$('.modal > div > label[ for="newEmail" ]');
        const emailInput = await page.$eval(
            '[ id="newEmail" ]',
            email => (email as HTMLInputElement).value);
        const passwordLabel = await page.$('.modal > div > label[ for="newPassword" ]');
        const passwordInput = await page.$eval(
            '[ id="newPassword" ]',
            password => (password as HTMLInputElement).value);
        const confirmPasswordLabel = await page.$('.modal > div > label[ for="confirmPassword" ]');
        const confirmPasswordInput = await page.$eval(
            '[ id="confirmPassword" ]',
            password => (password as HTMLInputElement).value);
        const createUserButton = await page.$eval(
            '.modal > div > input[ type="button" ]',
            login => (login as HTMLInputElement).value);

        await expect(header).toMatch('New user');
        await expect(emailLabel).toMatch('Email:');
        expect(emailInput).toBe('');
        await expect(passwordLabel).toMatch('Password:');
        expect(passwordInput).toBe('');
        await expect(confirmPasswordLabel).toMatch('Confirm password:');
        expect(confirmPasswordInput).toBe('');
        expect(createUserButton).toBe('Create user');
    });
});
