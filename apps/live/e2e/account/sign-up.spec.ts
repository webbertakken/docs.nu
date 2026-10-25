import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshEmail, giveOwnClientAddress, readSignInCode } from './sign-in';

// Sign-up with an email code (docs/specs/014-identity/auth-and-guest-access.md "Auth surface", "Email for sign-in"),
// through the page as a person does it: a name and an address on /get-started, Send code, the code from the
// stack's outbox (this host sends no email, and says so), then the welcome flow on /new, signed in.

test.use({ colorScheme: 'dark' });

test('a new person signs up with an email code and lands on /new, signed in', async ({
  page,
  context,
  baseURL,
  pageErrors,
}) => {
  await giveOwnClientAddress(context, baseURL!);
  const email = freshEmail('Nora Quill');
  await page.goto('/get-started');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await page.getByLabel('Your name').fill('Nora Quill');
  await page.getByLabel('Email').fill(email);
  const since = Date.now() - 1_000;
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  // A host whose codes stay in the outbox points at it rather than at a mailbox.
  await expect(page.getByRole('link', { name: /This preview sends no email/ })).toBeVisible();
  const code = await readSignInCode(context.request, baseURL!, email, since);
  // The sixth digit signs in by itself, as typing or pasting the code does.
  await page.getByLabel('6-digit code').fill(code);

  await expect(page).toHaveURL(/\/new\/?$/);
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await expect(trigger).toContainText('Nora');
  await trigger.click();
  await expect(page.getByRole('menu')).toHaveAccessibleName(/Nora Quill/);

  const session = (await (await context.request.get('/api/auth/get-session')).json()) as {
    user: { name: string; email: string };
  };
  expect(session.user).toMatchObject({ name: 'Nora Quill', email });
  expectNoPageErrors(pageErrors);
});
