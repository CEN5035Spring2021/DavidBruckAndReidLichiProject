import 'expect-puppeteer';
import { simpleParser } from 'mailparser';
import type { Page } from 'puppeteer/lib/cjs/puppeteer/api-docs-entry';
import { waitForEmail } from '../modules/smtpCoordinator';

describe('Sending and receiving messages notifies immediately', () => {
    const EMAIL_ADDRESS = 'sending-and-receiving-messages-notifies-immediately@cen.5035';
    const GROUP_USER_EMAIL_ADDRESS = 'sending-and-receiving-messages-notifies-immediately2@cen.5035';
    const ORGANIZATION_NAME = 'Organization - messages test';
    const GROUP_NAME = 'Group - messages test';
    const MESSAGE_TO_USER2 = 'User 1->2 ping';
    const MESSAGE_TO_USER1 = 'User 2->1 pong';

    let page2: Page | undefined;
    beforeEach(async() => {
        await page.goto('http://localhost:5000');
        await page.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        let createNewUser = await page.$('button');

        await createNewUser?.click();

        let emailInput = await page.$('[ id="newEmail" ]');
        let passwordInput = await page.$('[ id="newPassword" ]');
        let confirmPasswordInput = await page.$('[ id="confirmPassword" ]');
        let password = 'MyT3stP@ss';

        await emailInput?.type(EMAIL_ADDRESS);
        await passwordInput?.type(password);
        await confirmPasswordInput?.type(password);

        const createUserButtonSelector = '.modal > div > input[ type="button" ][ value="Create user" ]';
        let createUserButton = await page.$(createUserButtonSelector);

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

        let email = await simpleParser(
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

        await expect(page).not.toMatch(
            'Creating group...',
            {
                timeout: 30000
            });

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

        const inviteGroupUserButton =
            await page.$('.modal > div > input[ type="button" ][ value="Invite group user" ]');

        await inviteGroupUserButton?.click();

        await expect(page).toMatch(
            'Confirmation email sent',
            {
                timeout: 30000
            });

        page2 = await browser.newPage();

        await page2.goto('http://localhost:5000');
        await page2.waitForSelector(
            '.modal',
            {
                hidden: true,
                timeout: 30000
            });

        createNewUser = await page2.$('button');

        await createNewUser?.click();

        emailInput = await page2.$('[ id="newEmail" ]');
        passwordInput = await page2.$('[ id="newPassword" ]');
        confirmPasswordInput = await page2.$('[ id="confirmPassword" ]');
        password = 'MyT3stP@ss2';

        await emailInput?.type(GROUP_USER_EMAIL_ADDRESS);
        await passwordInput?.type(password);
        await confirmPasswordInput?.type(password);

        createUserButton = await page2.$(createUserButtonSelector);

        await createUserButton?.click();
        await page2.waitForSelector(
            createUserButtonSelector,
            {
                hidden: true,
                timeout: 30000
            });

        email = await simpleParser(
            await waitForEmail(GROUP_USER_EMAIL_ADDRESS));

        if (email.text) {
            const linkHeader = 'Login with your email address in the original browser to finish group user creation:';
            const link = email.text
                .substr(email.text.search(linkHeader) + linkHeader.length)
                .trim();

            await page2.goto(link);
        }

        await expect(page2).toMatch(
            'User added to group',
            {
                timeout: 30000
            });

        const closeAddedGroup = await page2.$('.modal > span');

        await closeAddedGroup?.click();

        await page.bringToFront();

        const inviteSelfToGroup = await page.$('.modal > div > ul > li');

        await inviteSelfToGroup?.click();

        await expect(page).toMatch(
            'Created',
            {
                timeout: 30000
            });

        const closeNewGroupUser = await page.$('.modal > span');

        await closeNewGroupUser?.click();

        const user2 = await page.$x(`//div[contains(text(), '${GROUP_USER_EMAIL_ADDRESS}')]`);

        expect(user2.length).toBe(1);

        await user2[0].click();

        let messageTextarea = await page.$('.conversations > textarea');

        await messageTextarea?.type(MESSAGE_TO_USER2);

        let sendMessage = await page.$('.conversations > input');

        await sendMessage?.click();

        await expect(page).toMatch(
            `${EMAIL_ADDRESS}:`,
            {
                timeout: 30000
            });

        await page2.bringToFront();

        await page2.waitForFunction(
            (emailAddress : string) => {
                const firstGroupDiv = document.querySelector('div.groups > div > ul > li > hr + div');
                if (!firstGroupDiv) {
                    return false;
                }
                const groupDivChildren = firstGroupDiv.childNodes;
                for (let groupDivChildIdx = 0, groupDivChildrenLength = groupDivChildren.length;
                    groupDivChildIdx < groupDivChildrenLength;
                    groupDivChildIdx++) {
                    const groupDivChild = groupDivChildren[groupDivChildIdx];
                    if (groupDivChild.nodeType === 3 // TextNode
                        && groupDivChild.nodeValue
                        && groupDivChild.nodeValue.trim() === emailAddress) {
                        return true;
                    }
                }
            },
            {
                timeout: 30000
            },
            EMAIL_ADDRESS);

        const user1 = await page2.$x(`//div[contains(text(), '${EMAIL_ADDRESS}')]`);

        expect(user1.length).toBe(1);

        await user1[0].click();

        await expect(page2).toMatch(
            `${EMAIL_ADDRESS}:`,
            {
                timeout: 30000
            });

        messageTextarea = await page2.$('.conversations > textarea');

        await messageTextarea?.type(MESSAGE_TO_USER1);

        sendMessage = await page2.$('.conversations > input');

        await sendMessage?.click();

        await expect(page2).toMatch(
            `${GROUP_USER_EMAIL_ADDRESS}:`,
            {
                timeout: 30000
            });
    });

    it('When an existing user is added to a group, they see the new group', async() => {

        const messageFromUser1 = await page2?.$x(`//li[contains(text(), '${MESSAGE_TO_USER2}')]`);

        expect(messageFromUser1?.length).toBe(1);

        const messageToUser1 = await page2?.$x(`//li[contains(text(), '${MESSAGE_TO_USER1}')]`);

        expect(messageToUser1?.length).toBe(1);

        await page.bringToFront();

        await page.waitForFunction(
            (emailAddress : string) => {
                const firstGroupDiv = document.querySelector('div.groups > div > ul > li > hr + div');
                if (!firstGroupDiv) {
                    return false;
                }
                const groupDivChildren = firstGroupDiv.childNodes;
                for (let groupDivChildIdx = 0, groupDivChildrenLength = groupDivChildren.length;
                    groupDivChildIdx < groupDivChildrenLength;
                    groupDivChildIdx++) {
                    const groupDivChild = groupDivChildren[groupDivChildIdx];
                    if (groupDivChild.nodeType === 3 // TextNode
                        && groupDivChild.nodeValue
                        && groupDivChild.nodeValue.trim() === emailAddress) {
                        return true;
                    }
                }
            },
            {
                timeout: 30000
            },
            GROUP_USER_EMAIL_ADDRESS);

        const messageToUser2 = await page?.$x(`//li[contains(text(), '${MESSAGE_TO_USER2}')]`);

        expect(messageToUser2?.length).toBe(1);

        await expect(page).toMatch(
            `${GROUP_USER_EMAIL_ADDRESS}:`,
            {
                timeout: 30000
            });

        const messageFromUser2 = await page?.$x(`//li[contains(text(), '${MESSAGE_TO_USER1}')]`);

        expect(messageFromUser2?.length).toBe(1);
    });
});
