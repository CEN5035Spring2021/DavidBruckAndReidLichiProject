import 'expect-puppeteer';
import { simpleParser } from 'mailparser';
import { waitForEmail } from '../modules/smtpCoordinator';

describe('Creating organization sends email', () => {
    const EMAIL_ADDRESS = 'creating-organization-sends-email@cen.5035';

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

        const emailInput = await page.$('[ id="newEmail" ]');
        const passwordInput = await page.$('[ id="newPassword" ]');
        const confirmPasswordInput = await page.$('[ id="confirmPassword" ]');
        const password = 'MyT3stP@ss';

        await emailInput?.type(EMAIL_ADDRESS);
        await passwordInput?.type(password);
        await confirmPasswordInput?.type(password);

        const createUserButtonSelector = '.modal > div > input[ type="button" ][ value="Create user" ]';
        const createUserButton = await page.$(createUserButtonSelector);

        await createUserButton?.click();
        await page.waitForSelector(
            createUserButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });

        const createNewOrganization =
            await page.$('div.organizations > div.items > input[ type="button" ][ value="Create new organization" ]');

        await createNewOrganization?.click();

        const nameInput = await page.$('[ id="newName" ]');

        await nameInput?.type('EmailTest');
    });

    it('Creating organization sends email', async() => {
        const createOrganizationButton =
            await page.$('.modal > div > input[ type="button" ][ value="Create organization" ]');

        const emailReceived = waitForEmail(EMAIL_ADDRESS);
        await createOrganizationButton?.click();

        await expect(page).toMatch(
            'Server response: ConfirmationEmailSent',
            {
                timeout: 30000
            });

        const email = await simpleParser(
            await emailReceived);

        await expect(email.text).toMatch(
            'Login with your email address in the original browser to finish organization creation:');
    });
});
