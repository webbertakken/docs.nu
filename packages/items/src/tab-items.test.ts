import { describe, expect, it } from 'vitest';
import { presetSetup } from './presets';
import { elementReach, tabShowsEveryCard } from './tab-items';

// docs/specs/013-workspace/tab-scoped-share-links.md "Structure": what pulls cards onto a tab.

describe('tabShowsEveryCard', () => {
  it('holds for a tab with a Plan board or a plan view, and for no other', () => {
    expect(tabShowsEveryCard([{ shape: 'plan-board', planBoard: presetSetup('kanban') }])).toBe(
      true,
    );
    expect(tabShowsEveryCard([{ shape: 'plan-view' }])).toBe(true);
    expect(tabShowsEveryCard([{ shape: 'plan-card', planCard: { itemId: 'i1' } }])).toBe(false);
    expect(
      tabShowsEveryCard([{ shape: 'plan-board', planBoard: 'broken' }, { shape: 'square' }]),
    ).toBe(false);
    expect(tabShowsEveryCard([])).toBe(false);
  });
});

describe('elementReach', () => {
  it('names a board, a plan view and the card a Plan card shows; null for anything else', () => {
    expect(elementReach({ shape: 'plan-board', planBoard: presetSetup('kanban') })).toBe('board');
    expect(elementReach({ shape: 'plan-board', planBoard: 'broken' })).toBeNull();
    expect(elementReach({ shape: 'plan-view' })).toBe('view');
    expect(elementReach({ shape: 'plan-card', planCard: { itemId: 'i1' } })).toBe('card:i1');
    expect(elementReach({ shape: 'plan-card', planCard: {} })).toBeNull();
    expect(elementReach({ shape: 'square' })).toBeNull();
  });
});
