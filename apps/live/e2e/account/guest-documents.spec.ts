import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, expectNoPageErrors, pageOwnerHeaders, test } from '../fixtures';
import { giveOwnClientAddress, readSignInCode, signIn } from './sign-in';

// A guest's documents come with them when they sign in (docs/specs/014-identity/auth-and-guest-access.md
// "Guest → account upgrade", "Moving documents in This Browser after signing in"): what the guest saved on the
// server moves into the account by the signed guest id, and what lives only in this browser is offered with
// "Move Documents in This Browser to Your Account?", moved only when the person says so.

test.use({ colorScheme: 'dark' });

// An account that already exists, made in a browser of its own: signing in to it from the guest's page then
// lands on the Explorer, as a returning person's sign-in does.
async function existingAccount(browser: Browser, baseURL: string, name: string): Promise<string> {
  const elsewhere = await browser.newContext({ baseURL });
  const { email } = await signIn(elsewhere, { baseURL, name });
  await elsewhere.close();
  return email;
}

// Signs in through /sign-in as a person does, with the code from the stack's outbox.
async function signInThroughPage(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  email: string,
) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  const since = Date.now() - 1_000;
  await page.getByRole('button', { name: 'Send code' }).click();
  const code = await readSignInCode(context.request, baseURL, email, since);
  // The sixth digit signs in by itself, as typing or pasting the code does.
  await page.getByLabel('6-digit code').fill(code);
  // A returning person lands on the Explorer (POST_AUTH_SIGNIN_DEFAULT), which opens on Home.
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
}

// The page's own signed guest identity, once this host has given it one.
async function guestHeaders(page: Page, baseURL: string): Promise<Record<string, string>> {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('livedoc:v2:self-sig')))
    .toBeTruthy();
  return pageOwnerHeaders(page, { Origin: new URL(baseURL).origin });
}

async function accountHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const { token } = (await (await context.request.get('/api/auth/token')).json()) as {
    token: string;
  };
  return { Authorization: `Bearer ${token}` };
}

test('a guest’s server document moves into the account they sign in to', async ({
  page,
  context,
  browser,
  baseURL,
  pageErrors,
}) => {
  const email = await existingAccount(browser, baseURL!, 'Gil Moss');
  await giveOwnClientAddress(context, baseURL!);
  await page.goto('/explorer/recent');
  const asGuest = await guestHeaders(page, baseURL!);
  const documentId = crypto.randomUUID();
  const created = await page.request.post('/api/documents', {
    headers: asGuest,
    data: {
      id: documentId,
      name: 'Built as a guest',
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(created.status()).toBe(201);

  await signInThroughPage(page, context, baseURL!, email);

  await expect
    .poll(
      async () => {
        const mine = (await (
          await context.request.get('/api/documents', { headers: await accountHeaders(context) })
        ).json()) as { documents: { id: string }[] };
        return mine.documents.map((d) => d.id);
      },
      { message: 'the guest’s document is the account’s on the server' },
    )
    .toContain(documentId);
  await page.goto('/explorer/all');
  await expect(page.getByRole('link', { name: 'Built as a guest' }).first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('a document in This Browser moves only when the person says Move', async ({
  page,
  context,
  browser,
  baseURL,
  pageErrors,
}) => {
  const email = await existingAccount(browser, baseURL!, 'Ivy Holt');
  await giveOwnClientAddress(context, baseURL!);
  // The Explorer first, so this browser knows the host offers sign-in: a guest's new document then starts in
  // This Browser.
  await page.goto('/explorer/recent');
  const asGuest = await guestHeaders(page, baseURL!);
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  const documentId = new URL(page.url()).pathname.split('/').pop()!;
  // Not on the server: only this browser holds it.
  expect(
    (await page.request.get(`/api/documents/${documentId}`, { headers: asGuest })).status(),
  ).toBe(404);

  await signInThroughPage(page, context, baseURL!, email);

  const prompt = page.getByRole('dialog', {
    name: 'Move Documents in This Browser to Your Account?',
  });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('checkbox')).not.toHaveCount(0);
  // Signing in moved nothing by itself.
  expect(
    (
      await context.request.get(`/api/documents/${documentId}`, {
        headers: await accountHeaders(context),
      })
    ).status(),
  ).toBe(404);
  await prompt.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(prompt).toHaveCount(0);

  await expect
    .poll(
      async () =>
        (
          await context.request.get(`/api/documents/${documentId}`, {
            headers: await accountHeaders(context),
          })
        ).status(),
      { message: 'the moved document is the account’s on the server' },
    )
    .toBe(200);
  expectNoPageErrors(pageErrors);
});
