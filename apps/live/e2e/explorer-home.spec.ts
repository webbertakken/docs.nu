import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import {
  asGuest,
  box,
  editLink,
  openDocument,
  person,
  seedBusyHome,
  seedHomeDocument,
  seedLocalDocuments,
  seedWithinReach,
  visitorSaves,
} from './home-seed';

// Explorer Home (docs/specs/013-workspace/explorer-home.md), end to end against the real build and
// api worker, as a guest, in dark mode: the Explorer lands on Home, its page header then one column of Jump
// back in and What Happened, each opened by a heading with a rule; Jump Back In is a Within reach set (4
// most used thumbnails on top, 4 recent below, one list with no group titles, none twice), or a phone strip that
// alternates, holds eight and ends in See More; See More opens Recent, under Home; nothing shifts as
// Home lands.

test.use({ colorScheme: 'dark' });

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 500);
      }),
  );
}

// Jump Back In's documents: the grid on a wide screen, the strip on a phone.
const jumpBackIn = (page: Page) =>
  page.getByRole('region', { name: 'Jump Back In' }).getByRole('listitem');
const names = async (list: Locator) =>
  list.getByRole('link').evaluateAll((links) => links.map((l) => l.getAttribute('aria-label')));

test('the Explorer lands on Home: Jump Back In, then What Happened, no Timeline', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const { owner, payments } = await seedBusyHome(page.request, origin);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/explorer');
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  // Home takes the ordinary page header, with no banner: its title is the page's heading, New Document beside it, and
  // the header's field is the one search field.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home');
  await expect(page.getByRole('combobox', { name: 'Filter documents' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'New Document' }).first()).toBeVisible();
  await expect(page).toHaveTitle('Home | LiveDoc');

  const jump = page.getByRole('region', { name: 'Jump Back In' });
  const happened = page.getByRole('region', { name: 'What Happened' });
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(3);
  await expect(
    jumpBackIn(page).getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/document/${payments}`);
  // No Timeline column, no switch; the groups carry no titles (Calm by default).
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(jump.getByRole('heading', { level: 3 })).toHaveCount(0);

  // One column: What Happened sits under Jump Back In, the same width.
  const [a, b] = [await jump.boundingBox(), await happened.boundingBox()];
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  expect(Math.round(b!.width)).toBe(Math.round(a!.width));

  // Two people on one document: one summary, collapsed, that expands to every action.
  const summary = happened.getByRole('button', {
    name: /^(Sam and Priya|Priya and Sam) commented and edited in Payments architecture/,
  });
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toContainText('My Documents');
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  const actions = page.locator(`#${await summary.getAttribute('aria-controls')}`);
  await expect(actions.getByRole('link', { name: /^Priya commented/ })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^Sam edited/ })).toBeVisible();

  expect(await layoutShift(page)).toBe(0);

  // See Timeline: the feed, titled Timeline, its sidebar row highlighted; Home's row leads back.
  await happened.getByRole('link', { name: 'See Timeline' }).click();
  await expect(page).toHaveURL(/\/explorer\/timeline\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'Timeline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('treeitem', { name: /^Home/ }).click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('each section opens with a heading and a rule under it, in dark and light', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const { owner } = await seedBusyHome(page.request, origin);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(3);

  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(
      (s) => document.documentElement.classList.toggle('dark', s === 'dark'),
      scheme,
    );
    for (const [name, link] of [
      ['Jump Back In', 'See More'],
      ['What Happened', 'See Timeline'],
    ] as const) {
      const heading = page.getByRole('heading', { level: 2, name });
      const row = heading.locator('..');
      const style = await row.evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.borderBottomWidth, style: s.borderBottomStyle };
      });
      // A hairline rule under the heading row.
      expect(style.width, `${scheme} ${name} has a rule`).toBe('1px');
      expect(style.style).toBe('solid');
      // The row spans the section; the link sits at its right end.
      const section = page.getByRole('region', { name });
      expect(Math.round((await row.boundingBox())!.width)).toBe(
        Math.round((await section.boundingBox())!.width),
      );
      const linkBox = await row.getByRole('link', { name: link }).boundingBox();
      const rowBox = await row.boundingBox();
      expect(Math.round(linkBox!.x + linkBox!.width)).toBe(Math.round(rowBox!.x + rowBox!.width));
      expect(await heading.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBe(
        16,
      );
    }
  }
  expectNoPageErrors(pageErrors);
});

test('Jump Back In is 4 most used thumbnails over 4 recent, untitled, none twice', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedWithinReach(page, origin, owner);

  const list = jumpBackIn(page);
  await expect(list.getByRole('link')).toHaveCount(8);
  // One list, no group titles: the most used, then the recent.
  await expect(page.getByRole('region', { name: 'Jump Back In' }).getByRole('list')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Most Used' })).toHaveCount(0);
  expect(await names(list)).toEqual([
    'Atlas, This Browser',
    'Beacon, This Browser',
    'Compass, This Browser',
    'Delta, This Browser',
    'Server two',
    'Server one',
    'Echo, This Browser',
    'Foxtrot, This Browser',
  ]);
  // Atlas is both the most used and the newest: it shows once, among the most used.
  await expect(list.getByRole('link', { name: /^Atlas/ })).toHaveCount(1);

  // A 4 by 2 grid: most used on top, recent below; no sideways scrolling.
  const tops = await list.evaluateAll((items) =>
    items.map((i) => Math.round(i.getBoundingClientRect().top)),
  );
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(new Set(tops.slice(4)).size).toBe(1);
  expect(tops[4]!).toBeGreaterThan(tops[0]!);
  const region = page.getByRole('region', { name: 'Jump Back In' });
  expect(await region.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  // See More: the Recent page, under Home in the breadcrumb.
  await page
    .getByRole('region', { name: 'Jump Back In' })
    .getByRole('link', { name: 'See More' })
    .click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Recent' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('on a phone the strip alternates, holds eight and ends in See More', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWithinReach(page, origin, owner);

  const list = jumpBackIn(page);
  await expect(list.getByRole('link')).toHaveCount(8);
  expect(await names(list)).toEqual([
    'Atlas, This Browser',
    'Server two',
    'Beacon, This Browser',
    'Server one',
    'Compass, This Browser',
    'Echo, This Browser',
    'Delta, This Browser',
    'Foxtrot, This Browser',
  ]);
  // One row, sideways.
  const tops = await list.evaluateAll((items) =>
    items.map((i) => Math.round(i.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);

  // The strip ends in See More, the only one (no heading-row link on a phone).
  const region = page.getByRole('region', { name: 'Jump Back In' });
  const seeMore = region.getByRole('link', { name: 'See More' });
  await expect(seeMore).toHaveCount(1);
  await seeMore.scrollIntoViewIfNeeded();
  const tile = await seeMore.boundingBox();
  const last = await list.last().boundingBox();
  expect(tile!.x).toBeGreaterThan(last!.x);
  await seeMore.click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  expectNoPageErrors(pageErrors);
});

test('a document opened from Jump Back In opens in the editor', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Service map');
  await asGuest(page, owner);

  // Open it once in the editor: that open is what puts it in Jump Back In.
  await page.goto(`/document/${doc.id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await page.goto('/explorer/home');
  const link = jumpBackIn(page).getByRole('link', { name: 'Service map' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/document/${doc.id}`));
  expectNoPageErrors(pageErrors);
});

test('with fewer than eight, only what exists shows, and nothing shifts', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Only one');
  await openDocument(page.request, owner, doc);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');

  const list = jumpBackIn(page);
  await expect(list).toHaveCount(1);
  // The grid keeps two rows' height (D131): 2 × 100 px and the 12 px gap. What Happened never moves.
  const grid = page.getByRole('region', { name: 'Jump Back In' }).getByRole('list');
  expect(Math.round((await grid.boundingBox())!.height)).toBe(212);
  expect(await layoutShift(page)).toBe(0);
  expectNoPageErrors(pageErrors);
});

test('a document stored only in this browser joins Jump Back In with its pill', async ({
  page,
  pageErrors,
}) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');
  // Nothing yet: the first run's starts (explorer-home.md "First run"), not an empty Jump Back In.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home');
  await expect(page.getByRole('region', { name: 'Start Blank' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Blank Diagram/ })).toHaveAttribute(
    'href',
    '/new?template=blank',
  );

  await seedLocalDocuments(page, [{ name: 'Kept on this laptop', daysAgo: [0], lastOpenedIn: 0 }]);
  await page.reload();
  const link = jumpBackIn(page).getByRole('link', { name: 'Kept on this laptop, This Browser' });
  await expect(link).toBeVisible();
  await expect(link.getByText('This Browser', { exact: true })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('a failed read says so, and Try again reads again', async ({ page, pageErrors }) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.route('**/api/home?*', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/explorer/home');
  const failed = page.getByText('Home could not load. Check your connection and try again.');
  await expect(failed).toBeVisible({ timeout: 20_000 });

  await page.unroute('**/api/home?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(failed).toHaveCount(0);
  // A guest with nothing yet: the read in, Home is the first run's starts (explorer-home.md "First run").
  await expect(page.getByRole('region', { name: 'Start Blank' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('what others did since the last look is marked New', async ({ page, baseURL, pageErrors }) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Launch plan');
  const code = await editLink(page.request, owner, origin, doc.id);
  await asGuest(page, owner);

  // The first look sets the mark; nothing is new to someone who never looked. With nothing from anyone
  // yet, What Happened is left out (explorer-home.md "What happened").
  await page.goto('/explorer/home');
  await expect(page.getByRole('region', { name: 'Jump Back In' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'What Happened' })).toHaveCount(0);

  const lee = await person(page.request, 'Lee', '#14b8a6');
  await visitorSaves(page.request, lee, code, doc, [box('a', 'Launch day', 40, 40)]);
  await page.reload();
  const entry = page.getByRole('link', { name: /^Lee edited Launch plan/ });
  await expect(entry).toBeVisible();
  await expect(entry.getByText('New', { exact: true })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
