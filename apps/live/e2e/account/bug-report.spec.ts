import { expect, expectNoPageErrors, test } from '../fixtures';
import { signIn } from './sign-in';

// Report a Bug signed in (docs/specs/016-platform/bug-reports.md "Entries", "Filing"): the account menu's entry
// opens the form, the report goes with the session, not a guest id, and focus returns to the menu's button.

test.use({ colorScheme: 'dark' });

test('a signed-in person reports a bug from the account menu', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  await signIn(context, { baseURL: baseURL!, name: 'Rae Bugg' });
  const headers: Record<string, string>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/bug-reports')) headers.push(r.headers());
  });
  await page.goto('/explorer/recent');
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Report a Bug' }).click();

  const dialog = page.getByRole('dialog', { name: 'Report a Bug' });
  await dialog.getByText("What's Attached").click();
  await expect(dialog.getByText('Your account id')).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'What went wrong?' })
    .fill('The Explorer list flickers');
  await dialog.getByRole('button', { name: 'Send Report' }).click();
  await expect(dialog.getByText('Saved; we will file it shortly.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(trigger).toBeFocused();
  expect(headers[0]?.authorization).toMatch(/^Bearer /);
  expect(headers[0]?.['x-owner-id']).toBeUndefined();
  expectNoPageErrors(pageErrors);
});
