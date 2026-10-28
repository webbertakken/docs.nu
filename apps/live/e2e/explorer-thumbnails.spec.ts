import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from '@livedoc/document';
import { apiBase, darkVisitor, seedDocument } from './audit-screens';
import { expect, expectNoPageErrors, mintSignedGuest, ownerHeaders, test } from './fixtures';

// The Explorer asks only for snapshots that exist (docs/specs/006-document/document-snapshots.md, "An
// empty document is never asked for"): the list says which documents are empty, so their cards show
// the undrawn sketch at once and no thumbnail request (and no 404) reaches the console.

test('an empty document is never asked for its thumbnail; a drawn one is', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = await mintSignedGuest(page.request);
  await darkVisitor(page, owner);
  const origin = new URL(baseURL!).origin;
  const drawn = await seedDocument(page, owner, origin);
  const empty = crypto.randomUUID();
  const created = await page.request.post(`${apiBase}/documents`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: {
      id: empty,
      name: 'Nothing yet',
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(created.ok()).toBe(true);

  const asked: string[] = [];
  const missing: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/thumbnail')) asked.push(r.url());
  });
  page.on('response', (r) => {
    if (r.url().includes('/thumbnail') && r.status() === 404) missing.push(r.url());
  });

  await page.goto('/explorer/recent');
  await expect(page.getByText('Nothing yet', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect.poll(() => asked.some((u) => u.includes(drawn)), { timeout: 15_000 }).toBe(true);

  expect(asked.filter((u) => u.includes(empty))).toEqual([]);
  expect(missing).toEqual([]);
  expectNoPageErrors(pageErrors);
});

// A thumbnail is the tab as the viewer would see it on opening it (document-snapshots.md "In the viewer's
// half"): a Default document stored in the light half previews on the dark canvas in dark chrome, before anyone
// opens it, and on the light one once the viewer switches to light.
test('a thumbnail is drawn in the viewer’s appearance, before the document is opened', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = await mintSignedGuest(page.request);
  await darkVisitor(page, owner);
  const origin = new URL(baseURL!).origin;
  const drawn = await seedDocument(page, owner, origin);

  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes(`/documents/${drawn}/thumbnail`)) asked.push(r.url());
  });
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  // The box the snapshot sits in takes the snapshot's own canvas colour.
  const thumbCanvas = () =>
    page
      .locator('img[src^="blob:"]')
      .first()
      .evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);

  await page.goto('/explorer/recent');
  await expect
    .poll(() => asked.some((u) => u.includes('appearance=dark')), { timeout: 15_000 })
    .toBe(true);
  await expect.poll(thumbCanvas, { timeout: 15_000 }).toBe(rgb(DARK_CANVAS_BACKGROUND_COLOR));

  // Switched on the real control, which cycles: the open Explorer asks for the other half at once.
  const toggle = page.getByRole('button', { name: /^Appearance: (Light|Dark|System)\./ }).first();
  await expect(toggle).toHaveAttribute('aria-label', /^Appearance: Dark\./);
  for (let i = 0; i < 3; i++) {
    if (/^Appearance: Light\./.test((await toggle.getAttribute('aria-label')) ?? '')) break;
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-label', /^Appearance: Light\./);
  await expect
    .poll(() => asked.some((u) => u.includes('appearance=light')), { timeout: 15_000 })
    .toBe(true);
  await expect.poll(thumbCanvas, { timeout: 15_000 }).toBe(rgb(DEFAULT_BACKGROUND_COLOR));

  expectNoPageErrors(pageErrors);
});
