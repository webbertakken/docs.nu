import { expect, expectNoPageErrors, test } from '../fixtures';
import { sessionOf, signIn } from './sign-in';

// Settings > Account (docs/specs/014-identity/auth-and-guest-access.md "Account settings"): the account's name is
// edited in place, and its sessions are listed with this one marked; signing out everywhere else ends the other
// browser's session at the api.

test.use({ colorScheme: 'dark' });

test('renames the account and signs out the other browser', async ({
  page,
  context,
  browser,
  baseURL,
  pageErrors,
}) => {
  const account = await signIn(context, { baseURL: baseURL!, name: 'Iris Holt' });
  const other = await browser.newContext({ baseURL, colorScheme: 'dark' });
  await signIn(other, { baseURL: baseURL!, name: 'Iris Holt', email: account.email });
  expect(await sessionOf(other)).not.toBeNull();

  await page.goto('/explorer/recent');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const name = settings.getByLabel('Your name');
  await expect(name).toHaveValue('Iris Holt');
  await name.fill('Iris Holt-Varga');
  await settings.getByRole('button', { name: 'Save' }).click();
  await expect(settings.getByText('Saved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Iris');

  await expect(settings.getByText('This browser')).toBeVisible();
  await settings.getByRole('button', { name: 'Sign Out Everywhere Else' }).click();
  await expect(settings.getByRole('button', { name: 'Sign Out Everywhere Else' })).toHaveCount(0);
  await expect.poll(() => sessionOf(other)).toBeNull();
  expect(await sessionOf(context)).not.toBeNull();

  await page.screenshot({ path: test.info().outputPath('account-settings.png'), fullPage: true });
  await other.close();
  expectNoPageErrors(pageErrors);
});
