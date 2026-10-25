import { test, expect, expectNoPageErrors } from '../fixtures';
import { signIn, type Account } from './sign-in';

// Explorer Home signed in (docs/specs/013-workspace/explorer-home.md): a team member's Home names what a teammate did on a team document, where it lives, and
// opens it; the person's own Jump Back In holds the document they opened, on a desktop and on a
// phone, and See More leads to Recent.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

// Calls the api as `who`, from their own browser context.
async function api(
  who: Account,
  method: 'POST' | 'PUT' | 'GET',
  path: string,
  data?: unknown,
  extra: Record<string, string> = {},
) {
  const res = await who.request.fetch(`/api${path}`, {
    method,
    headers: { ...(await who.apiHeaders()), ...extra },
    ...(data === undefined ? {} : { data }),
  });
  expect(res.ok(), `${method} ${path} failed: ${res.status()}`).toBe(true);
  return res;
}

test('a teammate’s work on a team document reaches Home, named and placed', async ({
  page,
  browser,
  baseURL,
  pageErrors,
}) => {
  const ann = await signIn(page.context(), { baseURL: baseURL!, name: 'Ann Tester' });
  const bobContext = await browser.newContext({ baseURL });
  const bob = await signIn(bobContext, { baseURL: baseURL!, name: 'Bob Tester' });
  const team = crypto.randomUUID();
  await api(ann, 'POST', '/teams', { id: team, name: 'Platform team' });
  const link = (await (await api(ann, 'POST', `/teams/${team}/invite-link`)).json()) as {
    inviteLink: { token: string };
  };
  await api(bob, 'POST', `/teams/invite-link/${link.inviteLink.token}/join`);
  await api(bob, 'PUT', `/participants/${bob.id}`, { name: 'Bob', color: '#f59e0b' });

  const doc = crypto.randomUUID();
  const tab = crypto.randomUUID();
  const shape = { id: 'a', type: 'shape', shape: 'square', x: 40, y: 40, width: 200, height: 100 };
  await api(ann, 'POST', '/documents', {
    id: doc,
    name: 'Payments architecture',
    teamId: team,
    tabs: [{ id: tab, name: 'Tab 1', elements: [{ ...shape, label: 'Ledger' }] }],
  });
  await api(ann, 'GET', `/documents/${doc}/tabs/${tab}`, undefined, {
    'X-Document-Open': '1',
  });
  await api(bob, 'PUT', `/documents/${doc}/tabs/${tab}`, {
    id: tab,
    name: 'Tab 1',
    elements: [
      {
        ...shape,
        label: 'Ledger service',
        commentThread: {
          resolved: false,
          comments: [
            {
              id: crypto.randomUUID(),
              text: 'Split this out?',
              createdAt: Date.now(),
              authorName: 'Bob',
              authorColor: '#f59e0b',
            },
          ],
        },
      },
    ],
  });

  await bobContext.close();
  await page.goto('/explorer');
  await expect(page).toHaveURL(/\/explorer\/home\/?$/, { timeout: 30_000 });
  const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
  await expect(nav.getByRole('treeitem', { name: 'Home' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await expect(
    page
      .getByRole('region', { name: 'Jump Back In' })
      .getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/document/${doc}`);
  const happened = page.getByRole('region', { name: 'What Happened' });

  // One teammate: each action its own entry, naming who, what, which document and where.
  const comment = happened.getByRole('link', { name: /^Bob commented on Payments architecture/ });
  await expect(comment).toContainText('“Split this out?”');
  await expect(comment).toContainText('Platform team');
  await expect(
    happened.getByRole('link', { name: /^Bob edited Payments architecture/ }),
  ).toBeVisible();

  // Home has no Timeline of its own.
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(0);

  // A phone: the same document in the strip, which ends in See More.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole('region', { name: 'Jump Back In' })
      .getByRole('link', { name: 'Payments architecture' }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Jump Back In' })
    .getByRole('link', { name: 'See More' })
    .click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  await page.goBack();
  await page.setViewportSize({ width: 1280, height: 800 });

  await comment.click();
  await expect(page).toHaveURL(new RegExp(`/document/${doc}`));
  expectNoPageErrors(pageErrors);
});
