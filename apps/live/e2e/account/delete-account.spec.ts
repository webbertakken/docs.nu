import { expect, expectNoPageErrors, test } from '../fixtures';
import { sessionOf, signIn } from './sign-in';

// Deleting an account (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"): Settings > Account >
// Delete Account, the account's email typed to confirm, deletes the data and the identity and signs the browser
// out. The address is free again afterwards: signing in with it starts a fresh, empty account.

test.use({ colorScheme: 'dark' });

test('deleting the account removes it, signs out, and frees the address', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  const dana = await signIn(context, { baseURL: baseURL!, name: 'Dana Reed' });
  const documentId = crypto.randomUUID();
  const created = await context.request.post('/api/documents', {
    headers: await dana.apiHeaders(),
    data: {
      id: documentId,
      name: 'Quarterly plan',
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(created.status()).toBe(201);

  await page.goto('/explorer/recent');
  await expect(page.getByRole('link', { name: 'Quarterly plan' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account' }).click();
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('button', { name: 'Delete Account' })
    .click();

  const confirm = page.getByRole('dialog', { name: 'Delete Account' });
  await expect(confirm).toBeVisible();
  const deleteButton = confirm.getByRole('button', { name: 'Delete Account' });
  await expect(deleteButton).toBeDisabled();
  await confirm.getByLabel(/to confirm/).fill(dana.email);
  await deleteButton.click();

  // Deleted, the page leaves for the landing page on its own, with a fresh load (SettingsAccountRows'
  // onDeleted). Wait for that navigation to land: a goto issued while it is in flight is interrupted by it, which
  // is how this spec failed on CI's slower runners while passing on a fast machine.
  await page.waitForURL((url) => url.pathname === '/', { waitUntil: 'load' });
  // In this stack the editor serves `/`, and its index forwards to `/new` once it hydrates (app/page.tsx). Wait for
  // that second navigation too, or the goto below races it.
  await page.waitForURL((url) => url.pathname === '/new', { waitUntil: 'load' });

  // Signed out, and the session is gone at the api, not only in this page.
  await expect.poll(() => sessionOf(context)).toBeNull();
  await page.goto('/explorer/recent');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toHaveCount(0);

  // The same address again: a new account, with nothing of the old one.
  const again = await signIn(context, { baseURL: baseURL!, name: 'Dana Reed', email: dana.email });
  expect(again.id).not.toBe(dana.id);
  const mine = (await (
    await context.request.get('/api/documents', { headers: await again.apiHeaders() })
  ).json()) as { documents: { id: string }[] };
  expect(mine.documents).toEqual([]);
  await page.goto('/explorer/recent');
  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Dana');
  await expect(page.getByRole('link', { name: 'Quarterly plan' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
