import { expect, expectNoPageErrors, test } from '../fixtures';
import { sessionOf, signIn } from './sign-in';

// Signing out (docs/specs/014-identity/auth-and-guest-access.md "Sessions"): the account menu's Sign out ends the
// session at the api, the header offers Sign in again, and a reload stays signed out: the session cookie is gone,
// not merely forgotten by the page.

test.use({ colorScheme: 'dark' });

test('signing out from the account menu ends the session for good', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  await signIn(context, { baseURL: baseURL!, name: 'Otto Vale' });
  await page.goto('/explorer/recent');
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await expect(trigger).toContainText('Otto');

  await trigger.click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  const signInLink = page.getByRole('link', { name: 'Sign in', exact: true });
  await expect(signInLink.first()).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect.poll(() => sessionOf(context)).toBeNull();

  await page.reload();
  await expect(signInLink.first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
