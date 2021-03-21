import 'expect-puppeteer';
import { simpleParser } from 'mailparser';
import { waitForEmail } from '../modules/smtpCoordinator';

describe('Cannot create organization with existing name', () => {
    const EMAIL_ADDRESS = 'cannot-create-organization-with-existing-name@cen.5035';

    beforeAll(async() => {
        await page.goto('http://localhost:5000');
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

        const nameInput = await page.$('[ id="newName" ]');

        const duplicateTestName = 'DuplicateTest';
        await nameInput?.type(duplicateTestName);

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

        if (email.text) {
            const linkHeader = 'Login with your email address in the original browser to finish organization creation:';
            const link = email.text
                .substr(email.text.search(linkHeader) + linkHeader.length)
                .trim();

            await page.goto(link);
        }
    });

    it('Cannot create organization with existing name', async() => {
        const createOrganizationButton =
            await page.$('.modal > div > input[ type="button" ][ value="Create organization" ]');

        await createOrganizationButton?.click();

        await expect(page).toMatch(
            'Server response: AlreadyExists',
            {
                timeout: 30000
            });
    });
});
