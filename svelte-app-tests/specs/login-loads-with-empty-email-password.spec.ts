import 'expect-puppeteer';

describe('Existing user login loads with empty inputs for email and password', () => {
    beforeAll(async() =>
        page.goto('http://localhost:5000'));

    it('Fieldset fields are all correct', async() => {
        const legend = await page.$('fieldset > legend');
        const emailLabel = await page.$('fieldset > label[ for="email" ]');
        const emailInput = await page.$eval(
            '[ id="email" ]',
            email => (email as HTMLInputElement).value);
        const passwordLabel = await page.$('fieldset > label[ for="password" ]');
        const passwordInput = await page.$eval(
            '[ id="password" ]',
            password => (password as HTMLInputElement).value);
        const loginButton = await page.$eval(
            'fieldset > input[ type="button" ]',
            login => (login as HTMLInputElement).value);
        const createNewUser = await page.$('button');

        await expect(legend).toMatch('Existing user');
        await expect(emailLabel).toMatch('Email:');
        expect(emailInput).toBe('');
        await expect(passwordLabel).toMatch('Password:');
        expect(passwordInput).toBe('');
        expect(loginButton).toBe('Login');
        await expect(createNewUser).toMatch('Create new user');
    });
});
