import type { Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openBlankSession, openStartBlank } from './fixtures';

// Palette drag-to-canvas (docs/specs/010-palette/palette-drag-ghost.md) from the Palette strip
// (docs/specs/007-editor/toolbar-layout.md): a tile in a category's flyout or More popover drags onto the canvas
// like the tile it stands for, whatever its catalogue: a shape from Shapes' flyout, a line icon and
// a sticker found by searching their own catalogue's body (Stickers are Workshop's,
// docs/specs/012-collaboration/workshop-mode.md).

const CANVAS = '[data-canvas-a11y-root]';

// A category's whole body, searched when it has a search field: its flyout on the category bar (Workshop), or its
// More popover on the category picker's strip (Diagram).
async function openMore(page: Page, category: string, query?: string): Promise<void> {
  const bar = page.locator(`[data-category-bar-button][aria-label="${category}"]`);
  if ((await bar.count()) > 0) await bar.click();
  else {
    await page.getByRole('button', { name: 'Palette category' }).click();
    await page
      .locator('[data-tour-id="palette-category-menu"]')
      .getByRole('option', { name: category })
      .first()
      .click();
    await page.getByRole('button', { name: /^More/ }).click();
  }
  await more(page).waitFor();
  if (query)
    await more(page)
      .getByRole('textbox', { name: /search/i })
      .fill(query);
}

const more = (page: Page) => page.locator('[data-category-flyout], [data-toolbar-more]');

// The elements on the canvas, by accessible name (the canvas a11y root names each one).
const placed = (page: Page, name: RegExp) => page.locator(CANVAS).getByRole('img', { name });

async function dragTileOntoCanvas(page: Page, tileName: string, at: { x: number; y: number }) {
  const tile = more(page).getByRole('button', { name: tileName, exact: true }).first();
  await expect(tile).toHaveAttribute('draggable', 'true');
  await tile.dragTo(page.locator(CANVAS), { targetPosition: at });
}

test.describe('Toolbar strip drag', () => {
  for (const { category, query, tile, placedAs, open } of [
    {
      category: 'Shapes',
      query: undefined,
      tile: 'Add Speech Bubble',
      placedAs: /speech bubble/i,
      open: openStartBlank,
    },
    {
      category: 'Icons',
      query: 'speech',
      tile: 'Add Message',
      placedAs: /^Icon$/,
      open: openStartBlank,
    },
    {
      category: 'Stickers',
      query: 'speech',
      tile: 'Speech balloon',
      placedAs: /^Sticker$/,
      open: openBlankSession,
    },
  ]) {
    test(`a "${tile}" tile from the ${category} flyout drags onto the canvas`, async ({
      page,
      pageErrors,
    }) => {
      await open(page);
      await openMore(page, category, query);
      await expect(placed(page, placedAs)).toHaveCount(0);
      await dragTileOntoCanvas(page, tile, { x: 300, y: 500 });
      await expect(placed(page, placedAs)).toHaveCount(1);
      expectNoPageErrors(pageErrors);
    });
  }
});
