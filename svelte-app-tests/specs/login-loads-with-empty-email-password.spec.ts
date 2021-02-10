import 'expect-puppeteer';

describe('Existing user login loads with empty inputs for email and password', () => {
    beforeAll(async() =>
        await page.goto('http://127.0.0.1:5000'));

    it('Fieldset fields are all correct', async () => {
        const legend = await page.$('fieldset > legend');
        const emailLabel = await page.$('fieldset > label[ for="email" ]');
        const emailInput = await page.$eval(
            'fieldset > input[ name="email" ]',
            email => (<HTMLInputElement>email).value);
        const passwordLabel = await page.$('fieldset > label[ for="password" ]');
        const passwordInput = await page.$eval(
            'fieldset > input[ name="password" ]',
            password => (<HTMLInputElement>password).value);
        const loginButton = await page.$eval(
            'fieldset > input[ type="button" ]',
            login => (<HTMLInputElement>login).value);

        expect(legend).toMatch('Existing user');
        expect(emailLabel).toMatch('Email:');
        expect(emailInput).toBe('');
        expect(passwordLabel).toMatch('Password:');
        expect(passwordInput).toBe('');
        expect(loginButton).toBe('Login');
    });
});
