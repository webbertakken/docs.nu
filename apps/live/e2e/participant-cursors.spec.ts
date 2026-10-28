import type { Browser, Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import { darkVisitor, freshDarkPage, seedDocument, shareLink } from './audit-screens';

// Another participant's cursor (docs/specs/012-collaboration/collaborator-enhancements.md §2 and §3), with a real
// room between two browsers: it steps aside while this screen's pointer is on it, never taking the click, and
// Hide Participant Cursors (in the Collaborators modal and in Settings) stops drawing it on this screen only.
// Dark mode.

const CANVAS = '[data-canvas-a11y-root]';
const SHOTS = process.env.E2E_SHOTS_DIR;

async function joinShared(page: Page, code: string): Promise<void> {
  await page.goto(`/document/shared?s=${code}`);
  const join = page.getByRole('button', { name: /^join$/i });
  if (await join.isVisible({ timeout: 5_000 }).catch(() => false)) await join.click();
  await page.locator(CANVAS).waitFor();
}

async function room(page: Page, browser: Browser, baseURL: string) {
  const owner = await mintSignedGuest(page.request);
  const origin = new URL(baseURL).origin;
  const id = await seedDocument(page, owner, origin);
  const code = await shareLink(page, owner, origin, id);
  await darkVisitor(page, owner);
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  const peer = await freshDarkPage(browser);
  await joinShared(peer, code);
  // The peer's pointer over the owner's canvas: its cursor on the owner's screen, once both are in the room.
  const box = (await peer.locator(CANVAS).boundingBox())!;
  const cursor = page.locator('[data-remote-cursor]').first();
  let step = 0;
  await expect(async () => {
    step += 1;
    await peer.mouse.move(box.x + 600 + step, box.y + 420, { steps: 3 });
    await expect(cursor).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  return { peer, cursor };
}

test.describe('participant cursors', () => {
  test('a cursor steps aside under the pointer and comes back when it leaves', async ({
    page,
    browser,
    baseURL,
    pageErrors,
  }) => {
    const { peer, cursor } = await room(page, browser, baseURL!);
    const at = (await cursor.boundingBox())!;
    const clip = { x: at.x - 120, y: at.y - 80, width: 360, height: 200 };
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1b-cursor-visible.png`, clip });
    await page.mouse.move(at.x + 4, at.y + 4);
    await expect(cursor).toHaveAttribute('data-faded', 'true');
    await expect(cursor).toHaveCSS('opacity', '0');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1b-cursor-faded.png`, clip });
    await page.mouse.move(at.x + 300, at.y + 200);
    await expect(cursor).not.toHaveAttribute('data-faded');
    expectNoPageErrors(pageErrors);
    await peer.context().close();
  });

  test('Hide Participant Cursors stops drawing them, from the Collaborators modal and Settings', async ({
    page,
    browser,
    baseURL,
    pageErrors,
  }) => {
    const { peer } = await room(page, browser, baseURL!);
    const cursors = page.locator('[data-remote-cursor]');

    // The Collaborators modal, from the presence stack: the switch sits at its foot.
    await page
      .getByRole('button', { name: /^Collaborators, showing/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Collaborators' });
    await dialog.waitFor();
    const modalSwitch = dialog.getByRole('switch', { name: /Hide Participant Cursors/ });
    if (SHOTS) await dialog.screenshot({ path: `${SHOTS}/1a-collaborators-switch.png` });
    await modalSwitch.click();
    await expect(modalSwitch).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(cursors).toHaveCount(0);

    // Settings shows the same switch, already on; off brings the cursor back.
    await page.getByRole('button', { name: 'Application settings' }).click();
    const settings = page.getByRole('dialog').first();
    await settings.getByLabel('Search settings').fill('participant cursors');
    const settingsSwitch = settings.getByRole('switch', { name: /Hide Participant Cursors/ });
    await expect(settingsSwitch).toHaveAttribute('aria-checked', 'true');
    if (SHOTS) await settings.screenshot({ path: `${SHOTS}/1a-settings-collaborate.png` });
    await settingsSwitch.click();
    await page.keyboard.press('Escape');
    const box = (await peer.locator(CANVAS).boundingBox())!;
    await peer.mouse.move(box.x + 500, box.y + 380, { steps: 5 });
    await expect(cursors.first()).toBeVisible();
    expectNoPageErrors(pageErrors);
    await peer.context().close();
  });
});
