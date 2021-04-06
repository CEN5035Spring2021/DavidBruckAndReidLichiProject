import 'expect-puppeteer';
import { simpleParser } from 'mailparser';
import { waitForEmail } from '../modules/smtpCoordinator';

describe('Creating group user sends email', () => {
    const EMAIL_ADDRESS = 'creating-group-user-sends-email@cen.5035';
    const ORGANIZATION_NAME = 'Organization - user email test';
    const GROUP_NAME = 'Group - user email test';
    const GROUP_USER_EMAIL_ADDRESS = 'creating-group-user-sends-email2@cen.5035';

    beforeEach(async() => {
        await page.goto('http://localhost:5000');
        await page.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        const createNewUser = await page.$('button');

        await createNewUser?.click();

        let emailInput = await page.$('[ id="newEmail" ]');
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

        const createNewOrganization = await page.$('div.organizations > div.items > button');

        await createNewOrganization?.click();

        let nameInput = await page.$('[ id="newName" ]');

        await nameInput?.type(ORGANIZATION_NAME);

        const createOrganizationButton =
            await page.$('.modal > div > input[ type="button" ][ value="Create organization" ]');

        const emailReceived = waitForEmail(EMAIL_ADDRESS);
        await createOrganizationButton?.click();

        await expect(page).toMatch(
            'Confirmation email sent',
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

        await page.waitForFunction(
            (groupSelectTestName : string) => {
                const modalDivs = document.querySelectorAll('.modal > div');
                for (let modalDivIdx = 0, modalDivsLength = modalDivs.length;
                    modalDivIdx < modalDivsLength;
                    modalDivIdx++) {
                    const modalDiv = modalDivs[modalDivIdx];
                    const modalDivChildren = modalDiv.childNodes;
                    for (let modalDivChildIdx = 0, modalDivChildrenLength = modalDivChildren.length;
                        modalDivChildIdx < modalDivChildrenLength;
                        modalDivChildIdx++) {
                        const modalDivChild = modalDivChildren[modalDivChildIdx];
                        if (modalDivChild.nodeType === 3 // TextNode
                            && modalDivChild.nodeValue
                            && modalDivChild.nodeValue.trim() === `Organization confirmed: ${groupSelectTestName}`) {
                            return true;
                        }
                    }
                }
            },
            {
                timeout: 30000
            },
            ORGANIZATION_NAME);

        const okButton =
            await page.$('.modal > div > input[ type="button" ][ value="Ok" ]');

        await okButton?.click();

        const organization = await page.$('div.organizations > div.items > ul > li');

        await organization?.click();
        await page.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        const createNewGroup = await page.$('div.groups > div.items > button');

        await createNewGroup?.click();

        nameInput = await page.$('[ id="newName" ]');

        await nameInput?.type(GROUP_NAME);

        const createGroupButton =
            await page.$('.modal > div > input[ type="button" ][ value="Create group" ]');

        await createGroupButton?.click();

        await expect(page).toMatch(
            'Created',
            {
                timeout: 30000
            });

        const closeNewGroup = await page.$('.modal > span');

        await closeNewGroup?.click();

        const manageGroup = await page.$('div.groups > div.items > ul > li.selected > button');

        await manageGroup?.click();

        emailInput = await page.$('[ id="newEmail" ]');

        await emailInput?.type(GROUP_USER_EMAIL_ADDRESS);
    });

    it('Creating group user sends email', async() => {
        const inviteGroupUserButton =
            await page.$('.modal > div > input[ type="button" ][ value="Invite group user" ]');

        const emailReceived = waitForEmail(GROUP_USER_EMAIL_ADDRESS);
        await inviteGroupUserButton?.click();

        await expect(page).toMatch(
            'Confirmation email sent',
            {
                timeout: 30000
            });

        const email = await simpleParser(
            await emailReceived);

        await expect(email.text).toMatch(
            'Login with your email address in the original browser to finish group user creation:');
    });
});
