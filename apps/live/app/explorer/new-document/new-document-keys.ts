// The New Document menu's keys (docs/specs/013-workspace/new-document-menu.md "Keyboard and screen readers"): where
// focus goes from where it is. The list is one column; the pane is its groups' templates, three to a row, the rows of
// every group one after another. Pure: the menu moves focus to the answer.
export type MenuSpot = { area: 'list'; row: number } | { area: 'pane'; row: number; col: number };

// The pane's rows, as how many cards each holds: [3, 3, 2, 3, 1] for groups of eight and four.
export type PaneRows = readonly number[];

export const TEMPLATES_PER_ROW = 3;

export function paneRowsFor(groupSizes: readonly number[]): PaneRows {
  const rows: number[] = [];
  for (const size of groupSizes) {
    for (let left = size; left > 0; left -= TEMPLATES_PER_ROW)
      rows.push(Math.min(TEMPLATES_PER_ROW, left));
  }
  return rows;
}

// Where each card of each group sits on the pane's rows, in order: the spot the arrow keys reach it by.
export function paneSpots(groupSizes: readonly number[]): { row: number; col: number }[][] {
  let row = 0;
  return groupSizes.map((size) => {
    const spots = Array.from({ length: size }, (_, i) => ({
      row: row + Math.floor(i / TEMPLATES_PER_ROW),
      col: i % TEMPLATES_PER_ROW,
    }));
    row += Math.ceil(size / TEMPLATES_PER_ROW);
    return spots;
  });
}

export function moveInMenu(
  key: string,
  at: MenuSpot,
  layout: { listLength: number; pane: PaneRows },
): MenuSpot | null {
  const { listLength, pane } = layout;
  if (at.area === 'list') {
    switch (key) {
      case 'ArrowDown':
        return { area: 'list', row: (at.row + 1) % listLength };
      case 'ArrowUp':
        return { area: 'list', row: (at.row - 1 + listLength) % listLength };
      case 'Home':
        return { area: 'list', row: 0 };
      case 'End':
        return { area: 'list', row: listLength - 1 };
      case 'ArrowLeft':
        return pane.length > 0 ? { area: 'pane', row: 0, col: 0 } : null;
      default:
        return null;
    }
  }
  const width = pane[at.row]!;
  // Up and down keep the column as near as the next row allows.
  const toRow = (row: number): MenuSpot => ({
    area: 'pane',
    row,
    col: Math.min(at.col, pane[row]! - 1),
  });
  switch (key) {
    case 'ArrowDown':
      return at.row < pane.length - 1 ? toRow(at.row + 1) : at;
    case 'ArrowUp':
      return at.row > 0 ? toRow(at.row - 1) : at;
    case 'ArrowLeft':
      return at.col > 0 ? { ...at, col: at.col - 1 } : at;
    case 'ArrowRight':
      // From the pane's right column, back to the list (the selected row: the menu knows which).
      return at.col < width - 1 ? { ...at, col: at.col + 1 } : { area: 'list', row: -1 };
    case 'Home':
      return { area: 'pane', row: 0, col: 0 };
    case 'End':
      return { area: 'pane', row: pane.length - 1, col: 0 };
    default:
      return null;
  }
}

// A digit 1 to 9 names a list row (0-based), or null.
export function digitRow(key: string, listLength: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const row = Number(key) - 1;
  return row < listLength ? row : null;
}
