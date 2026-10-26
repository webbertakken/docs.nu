import type { Server } from 'node:http';
import type { Page } from '@playwright/test';
import { FakeGoogle } from '@livediagram/fake-google';
import { serveFakeGoogle } from '@livediagram/fake-google/server';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshEmail, giveOwnClientAddress, sessionOf, signIn } from './sign-in';

// Sign-in with Google (docs/specs/014-identity/auth-and-guest-access.md "Sign-in methods"), against the fake Google: the
// browser's trip to Google's consent screen is answered here, and the api worker exchanges the code with the fake
// on the account stack's Google port (E2E_GOOGLE_PORT, scripts/e2e-stack.mjs). Everything between is the real
// thing: better-auth's state and PKCE, its callback, the account it makes or links, and the session cookie.

test.use({ colorScheme: 'dark' });
// One fake Google on one port, so both journeys run in one worker.
test.describe.configure({ mode: 'serial' });

const GOOGLE_PORT = Number(process.env.E2E_GOOGLE_PORT ?? 8797);
const fake = new FakeGoogle();
let server: Server;

test.beforeAll(async () => {
  server = await serveFakeGoogle(fake, GOOGLE_PORT);
});
test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Google's consent screen, as the person agreeing at once as `email`.
async function consentAs(page: Page, email: string): Promise<void> {
  await page.route('https://accounts.google.com/o/oauth2/v2/auth**', async (route) => {
    const asked = new URL(route.request().url());
    const back = new URL(asked.searchParams.get('redirect_uri')!);
    back.searchParams.set('code', fake.consent(email));
    back.searchParams.set('state', asked.searchParams.get('state')!);
    await route.fulfill({ status: 302, headers: { Location: back.toString() } });
  });
}

async function openAccountSettings(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account' }).click();
  return page.getByRole('dialog', { name: 'Settings' });
}

test('a new person signs in with Google and lands signed in, Google connected', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  await giveOwnClientAddress(context, new URL(baseURL!).origin);
  const email = `gwen.ashby-${Date.now()}@example.com`;
  await consentAs(page, email);

  await page.goto('/sign-in/?redirect_url=%2Fexplorer%2Frecent');
  await page.getByRole('button', { name: 'Continue with Google' }).click();

  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Gwen');
  expect(await sessionOf(context)).not.toBeNull();
  const settings = await openAccountSettings(page);
  await expect(settings.getByText(`· ${email}`)).toBeVisible();
  await expect(settings.getByText('· Connected')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('google-sign-in.png'), fullPage: true });
  expectNoPageErrors(pageErrors);
});

test('an email-code account connects Google from Settings, and removes it again', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  const email = freshEmail('Hal Brook');
  await signIn(context, { baseURL: baseURL!, name: 'Hal Brook', email });
  await consentAs(page, email);
  await page.goto('/explorer/recent');

  let settings = await openAccountSettings(page);
  await settings.getByRole('button', { name: 'Connect Google' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Hal');
  settings = await openAccountSettings(page);
  await expect(settings.getByText('· Connected')).toBeVisible();

  await settings.getByRole('button', { name: 'Remove' }).click();
  await expect(settings.getByRole('button', { name: 'Connect Google' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
