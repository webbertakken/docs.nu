import { enableDebugLogs, expect, expectNoPageErrors, test } from '../fixtures';
import {
  installOpenProbe,
  median,
  NEW_DOCUMENT_OPEN_BUDGET_MS,
  NEW_DOCUMENT_TEMPLATE_BUDGET_MS,
  openBlank,
  openExplorer,
  openKanban,
} from '../new-document-open';
import { signIn } from './sign-in';

// Opening at once on a host that offers sign-in (docs/specs/013-workspace/new-document-menu.md "Opening at once"):
// a signed-in person's new document is made on the server behind the open editor, and a guest's in This Browser;
// either way a blank is editable within 200 ms of the click and a template within 500 ms (D202).

const RUNS = 3;

// Every create's landing, by where it was saved (usePendingCreate's `released` line).
function releases(page: import('@playwright/test').Page): string[] {
  const seen: string[] = [];
  page.on('console', (m) => {
    const hit = /\[new-document\] released saves=(\w+)/.exec(m.text());
    if (hit) seen.push(hit[1]!);
  });
  return seen;
}

test.beforeEach(async ({ page, context }) => {
  await enableDebugLogs(context);
  await installOpenProbe(page);
  await page.addInitScript(() => localStorage.setItem('livedoc:v2:name-confirmed', '1'));
});

test('signed in: a blank and a template open within budget, made on the server', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  await signIn(page.context(), { baseURL: baseURL!, name: 'Pat Lane' });
  const saved = releases(page);
  const blanks: number[] = [];
  const templates: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    await openExplorer(page);
    // Made as a Diagram each time: the face follows the last blank, and a template run makes it a Board.
    await page.evaluate(() => localStorage.removeItem('livedoc:v2:last-new-document-blank'));
    await openExplorer(page);
    blanks.push(await openBlank(page));
    // Each create lands before the next page load, which would cut it short.
    await expect.poll(() => saved.length).toBe(run * 2 + 1);
    await openExplorer(page);
    templates.push(await openKanban(page));
    await expect.poll(() => saved.length).toBe(run * 2 + 2);
  }
  console.log(`[budget] signed-in blank ms=${blanks.join(',')} template ms=${templates.join(',')}`);
  expect(median(blanks)).toBeLessThanOrEqual(NEW_DOCUMENT_OPEN_BUDGET_MS);
  expect(median(templates)).toBeLessThanOrEqual(NEW_DOCUMENT_TEMPLATE_BUDGET_MS);
  expect(new Set(saved)).toEqual(new Set(['livedoc']));
  // On the server: a reload of the last one opens it from there.
  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator('[data-canvas-a11y-root]')).toBeAttached({ timeout: 15_000 });
  expectNoPageErrors(pageErrors);
});

test('a guest: a blank opens within budget, made in This Browser', async ({ page, pageErrors }) => {
  const saved = releases(page);
  const times: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    await openExplorer(page);
    times.push(await openBlank(page));
    await expect.poll(() => saved.length).toBe(run + 1);
  }
  console.log(`[budget] guest this-browser blank ms=${times.join(',')}`);
  expect(median(times)).toBeLessThanOrEqual(NEW_DOCUMENT_OPEN_BUDGET_MS);
  expect(new Set(saved)).toEqual(new Set(['browser']));
  expectNoPageErrors(pageErrors);
});
