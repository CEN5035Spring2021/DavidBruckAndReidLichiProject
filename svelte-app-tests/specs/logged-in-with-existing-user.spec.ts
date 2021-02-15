import 'expect-puppeteer';

describe('Created user is logged-in', () => {
    beforeAll(async() => {
        await page.goto('http://127.0.0.1:5000');
        const createNewUser = await page.$('button');
        
        await createNewUser?.click();
        
        const emailInput = await page.$('[ id="newEmail" ]');
        const passwordInput = await page.$('[ id="newPassword" ]');
        const confirmPasswordInput = await page.$('[ id="confirmPassword" ]');
        
        await emailInput?.type('logged-in-with-existing-user@cen.5035');
        await passwordInput?.type('MyT3stP@ss');
        await confirmPasswordInput?.type('MyT3stP@ss');
    });

    it('Created user is logged-in', async () => {
        const createUserButtonSelector = '.modal > div > input[ type="button" ]';
        const createUserButton = await page.$(createUserButtonSelector);

        await createUserButton?.click();
        await page.waitForSelector(
            createUserButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });

        await expect(page).toMatch('Logged in!');
    });
});
