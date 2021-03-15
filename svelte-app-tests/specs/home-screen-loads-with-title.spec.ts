import 'expect-puppeteer';

describe('Home screen loads with title', () => {
    beforeAll(async() =>
        page.goto('http://localhost:5000'));

    const h1Text = 'CEN5035 Spring 2021 David Bruck and Reid Lichi Project';
    it(`Should display header '${h1Text}'`, async () =>
        expect(page).toMatch(h1Text));
});
