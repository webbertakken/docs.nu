import { createInMode, expect, expectNoPageErrors, test } from './fixtures';

// A start's search finds templates in other modes (docs/specs/007-editor/start-diagramming.md "Found in other
// modes"): they show under Elsewhere, each saying where it leads, and choosing one lands it and changes the tab to
// match: a session template turns the Workshop control on, a Structured one takes a Plan start out of Plan.

// The open tab's editor mode, as the editor marks it.
const mode = (page: import('@playwright/test').Page) => page.locator('[data-editor-mode]');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('Start Diagramming finds a Workshop template and turns the Workshop control on', async ({
  page,
  pageErrors,
}) => {
  await createInMode(page, 'diagram');
  const start = page.getByRole('region', { name: 'Start Diagramming' });
  await start.getByRole('textbox', { name: 'Find a template' }).fill('sailboat');
  await expect(start.getByRole('status')).toHaveText(
    'No diagram templates match “sailboat”. Found elsewhere.',
  );
  const workshop = start
    .getByRole('region', { name: 'Elsewhere' })
    .getByRole('region', { name: 'Workshop' });
  const card = workshop.getByRole('button', { name: /^Sailboat Retrospective in Workshop:/ });
  await expect(card).toContainText('Opens in Workshop');
  await card.click();
  await expect(start).toBeHidden();
  await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
  await expect(mode(page)).toHaveAttribute('data-workshop', 'on');
  await expect(page.getByRole('button', { name: 'Workshop' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-canvas-a11y-root]').getByRole('img').first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('Start Planning finds a Structured template and the tab leaves Plan', async ({
  page,
  pageErrors,
}) => {
  await createInMode(page, 'plan');
  const start = page.getByRole('region', { name: 'Start Planning' });
  await start
    .getByRole('textbox', { name: 'Find a board, sheet, form or layout' })
    .fill('flowchart');
  await start
    .getByRole('region', { name: 'Elsewhere' })
    .getByRole('button', { name: /^Flowchart in Structured:/ })
    .click();
  await expect(start).toBeHidden();
  await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
  expectNoPageErrors(pageErrors);
});
