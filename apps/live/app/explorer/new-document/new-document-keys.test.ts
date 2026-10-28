import { describe, expect, it } from 'vitest';
import { digitRow, moveInMenu, paneRowsFor, paneSpots } from './new-document-keys';

const layout = { listLength: 8, pane: paneRowsFor([6, 2]) };

// docs/specs/013-workspace/new-document-menu.md "Keyboard and screen readers"
describe('New Document menu keys', () => {
  it('lays each group out three to a row, one group after another', () => {
    expect(paneRowsFor([6, 2])).toEqual([3, 3, 2]);
    expect(paneRowsFor([4])).toEqual([3, 1]);
    expect(paneSpots([4, 2])).toEqual([
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 0 },
      ],
      [
        { row: 2, col: 0 },
        { row: 2, col: 1 },
      ],
    ]);
  });

  it('moves along the list, wrapping at its ends', () => {
    expect(moveInMenu('ArrowDown', { area: 'list', row: 7 }, layout)).toEqual({
      area: 'list',
      row: 0,
    });
    expect(moveInMenu('ArrowUp', { area: 'list', row: 0 }, layout)).toEqual({
      area: 'list',
      row: 7,
    });
    expect(moveInMenu('End', { area: 'list', row: 2 }, layout)).toEqual({ area: 'list', row: 7 });
  });

  it('moves left from the list into the pane, on its first template', () => {
    expect(moveInMenu('ArrowLeft', { area: 'list', row: 3 }, layout)).toEqual({
      area: 'pane',
      row: 0,
      col: 0,
    });
  });

  it('moves through the templates as a grid, across groups', () => {
    expect(moveInMenu('ArrowDown', { area: 'pane', row: 0, col: 2 }, layout)).toEqual({
      area: 'pane',
      row: 1,
      col: 2,
    });
    expect(moveInMenu('ArrowDown', { area: 'pane', row: 1, col: 2 }, layout)).toEqual({
      area: 'pane',
      row: 2,
      col: 1,
    });
    expect(moveInMenu('ArrowRight', { area: 'pane', row: 1, col: 0 }, layout)).toEqual({
      area: 'pane',
      row: 1,
      col: 1,
    });
  });

  it('goes back to the list from the pane’s right column', () => {
    expect(moveInMenu('ArrowRight', { area: 'pane', row: 1, col: 2 }, layout)).toEqual({
      area: 'list',
      row: -1,
    });
  });

  it('leaves other keys to the menu', () => {
    expect(moveInMenu('Enter', { area: 'list', row: 0 }, layout)).toBeNull();
    expect(moveInMenu('Escape', { area: 'pane', row: 0, col: 0 }, layout)).toBeNull();
  });

  it('reads digits as list rows', () => {
    expect(digitRow('1', 8)).toBe(0);
    expect(digitRow('8', 8)).toBe(7);
    expect(digitRow('9', 8)).toBeNull();
    expect(digitRow('a', 8)).toBeNull();
  });
});
