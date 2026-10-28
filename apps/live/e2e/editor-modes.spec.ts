import type { Page } from '@playwright/test';
import {
  createInMode,
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
  pageOwnerHeaders,
} from './fixtures';

// Editor modes end to end (docs/specs/007-editor/editor-modes.md), in dark mode: the switch beside the menu button and
// an empty tab's start always agree, the tab menu offers none; a tab with content switches beside the menu button
// (Shift+D included) and keeps its strokes across a reload; a new tab opens in its maker's mode; and a switch reaches
// everyone at once, with Undo switching it back. Synthesised content only.

const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// The first tab's opening mode as the api stores it.
async function savedOpensIn(page: Page): Promise<unknown> {
  const headers = await pageOwnerHeaders(page);
  return page.evaluate(
    async ({ base, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const doc = (await (await fetch(`${base}/documents/${id}`, { headers })).json()) as {
        document?: { tabs?: { id: string }[] };
      };
      const tabId = doc.document?.tabs?.[0]?.id;
      if (!tabId) return undefined;
      const got = (await (
        await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
      ).json()) as { tab?: { opensIn?: unknown } };
      return got.tab?.opensIn;
    },
    { base: apiBase, headers },
  );
}

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
// The open tab's editor mode, as the editor marks it.
const mode = (page: Page) => page.locator('[data-editor-mode]');
// The start's own switch, and the one beside the menu button.
const startSwitch = (page: Page) => page.getByRole('button', { name: /^Tab mode: / });
const topSwitch = (page: Page) => page.getByRole('button', { name: /^Editor mode: / });
const boards = (page: Page) => page.locator('[data-plan-board]');
const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

// A new document in a mode, on its start, in dark mode at a desktop size.
async function openInMode(page: Page, name: 'diagram' | 'draw' | 'plan') {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  // The Plan and Workshop tours offer themselves 800 ms into their modes (OFFER_DELAY_MS), and their overlay
  // takes the presses these specs make there on a slow runner; it has its own unit tests.
  await page.addInitScript(() => {
    const key = 'livedoc:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      // The Plan tour offers each track once (lib/tour-tracks.ts): both answered.
      if (!Array.isArray(prefs.planTourTracks) || prefs.workshopTourSeen !== true)
        localStorage.setItem(
          key,
          JSON.stringify({
            ...prefs,
            planTourSeen: true,
            planTourTracks: ['boards', 'sheets'],
            workshopTourSeen: true,
          }),
        );
    } catch {
      // No storage: nothing to mark.
    }
  });
  await createInMode(page, name);
}

async function chooseOnStart(page: Page, name: 'Diagram' | 'Draw' | 'Plan') {
  await startSwitch(page).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

async function chooseBesideMenu(page: Page, name: 'Diagram' | 'Draw' | 'Workshop') {
  await topSwitch(page).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

// An empty tab offers each mode's start screen (docs/specs/007-editor/start-diagramming.md); its × starts from a
// blank canvas, as a person drawing straight away would close it.
async function closeStart(page: Page) {
  const start = page.getByRole('region', {
    name: /^Start (Diagramming|Drawing|Facilitating|Making Pages)$/,
  });
  await start.waitFor();
  await start.getByRole('button', { name: 'Close' }).click();
  await start.waitFor({ state: 'detached' });
}

async function drawWave(page: Page, from: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(from.x + i * 10, from.y + Math.sin(i / 5) * 50);
  }
  await page.mouse.up();
}

test.describe('editor modes', () => {
  // docs/specs/007-editor/editor-modes.md "The mode switch": beside the menu button and on an empty tab's start, the
  // two always agreeing; none in the tab menu.
  test("the switch beside the menu button agrees with the start's, and the tab menu offers none", async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(startSwitch(page)).toHaveAccessibleName('Tab mode: Diagram');
    await expect(topSwitch(page)).toHaveAccessibleName('Editor mode: Diagram');

    await chooseBesideMenu(page, 'Workshop');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'workshop');
    await expect(startSwitch(page)).toHaveAccessibleName('Tab mode: Workshop');
    await expect(topSwitch(page)).toHaveAccessibleName('Editor mode: Workshop');

    await chooseOnStart(page, 'Draw');
    await expect(topSwitch(page)).toHaveAccessibleName('Editor mode: Draw');

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tab menu' }).click();
    await expect(page.getByRole('button', { name: /^Mode/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Mode' })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('a drawn-on tab changes mode beside the menu button and keeps its strokes', async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    await chooseOnStart(page, 'Draw');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    await expect(dock(page)).toBeVisible();
    await closeStart(page);

    await page.keyboard.press('1');
    await drawWave(page, { x: 500, y: 600 });
    await expect(sketches(page)).toHaveCount(1);

    // Shift+D works on a tab with content: Draw steps to Workshop.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+D');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'workshop');

    await chooseBesideMenu(page, 'Diagram');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(sketches(page)).toHaveCount(1);

    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('diagram');
    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(sketches(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "Plan stands apart": an empty tab crosses Plan's line freely.
  test('Shift+D moves an empty tab to the next mode', async ({ page, pageErrors }) => {
    await openInMode(page, 'diagram');
    await closeStart(page);
    await page.locator(CANVAS).click({ position: { x: 800, y: 500 } });
    await page.keyboard.press('Shift+D');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    expectNoPageErrors(pageErrors);
  });

  test('a Plan tab with a board keeps its mode', async ({ page, pageErrors }) => {
    await openInMode(page, 'plan');
    await expect(page.getByRole('heading', { name: 'Start Planning' })).toBeVisible();
    await page.getByRole('button', { name: /^Kanban Board/ }).click();
    await expect(boards(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+D');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'plan');
    await expect(boards(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from".
  test('a new tab opens in the mode it was made from', async ({ page, pageErrors }) => {
    await openInMode(page, 'diagram');
    await chooseOnStart(page, 'Draw');
    await page.getByRole('button', { name: 'Add tab', exact: true }).click();
    await expect(page.locator('[data-editor-tabbar]').getByText('Tab 2')).toBeVisible();
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    // On its mode's own start, with no Quick Start over it.
    await expect(page.getByRole('region', { name: 'Start Drawing' })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": the mode is the tab's, the same
  // for everyone on it, and a switch is one undo step.
  test("the start's switch changes the tab for everyone, and Undo switches it back", async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    // A second window on the same tab, open before the switch.
    const other = await page.context().newPage();
    await other.emulateMedia({ colorScheme: 'dark' });
    await other.setViewportSize({ width: 1600, height: 900 });
    await other.goto(page.url());
    await other.locator(CANVAS).waitFor({ timeout: 30_000 });
    await dismissQuickTour(other);
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'diagram');

    await chooseOnStart(page, 'Draw');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('draw');
    // The other window follows the tab, live.
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'draw', { timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'diagram', { timeout: 15_000 });
    await other.close();
    expectNoPageErrors(pageErrors);
  });
});
