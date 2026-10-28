import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup } from '@livedoc/items';
import {
  keepStoredStructure,
  structureChange,
  structureRefusal,
  type StructuredTab,
} from './tab-structure';

// A tab-scoped Editor's limits on its own tab (docs/specs/013-workspace/tab-scoped-share-links.md "Structure").

const board = (id: string) => ({ id, shape: 'plan-board', planBoard: presetSetup('kanban') });
const card = (id: string, itemId: string) => ({ id, shape: 'plan-card', planCard: { itemId } });
const box = (id: string, label = '') => ({ id, shape: 'square', label });
const tab = (
  elements: object[],
  over: { name?: string; form?: unknown } = {},
): StructuredTab & { elements: object[] } => ({
  name: 'Board',
  elements,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('structureChange', () => {
  it('passes content changes: a box added, a box edited, a board left as it was', () => {
    const stored = tab([board('b1'), box('x', 'a')]);
    expect(structureChange(stored, tab([board('b1'), box('x', 'b'), box('y')]), 't1')).toBeNull();
  });

  it('names a rename, an added or removed Plan element, and a card pointed elsewhere', () => {
    const stored = tab([board('b1'), card('c1', 'i1')]);
    expect(structureChange(stored, { ...stored, name: 'Mine' }, 't1')).toBe('name');
    expect(structureChange(stored, tab([board('b1'), card('c1', 'i1'), board('b2')]), 't1')).toBe(
      'reach',
    );
    expect(structureChange(stored, tab([card('c1', 'i1')]), 't1')).toBe('reach');
    expect(structureChange(stored, tab([board('b1'), card('c1', 'i9')]), 't1')).toBe('reach');
    expect(structureChange(stored, tab([board('b1'), { ...box('c1') }]), 't1')).toBe('reach');
  });

  it('names a form pointed off the tab, and passes one kept as stored or on the tab itself', () => {
    const away = { destination: { tabId: 't2', typeId: 'task', status: 'todo' } };
    const here = { destination: { tabId: 't1', typeId: 'task', status: 'todo' } };
    expect(structureChange(tab([], { form: {} }), tab([], { form: away }), 't1')).toBe('form');
    expect(structureChange(tab([], { form: away }), tab([], { form: away }), 't1')).toBeNull();
    expect(structureChange(tab([], { form: {} }), tab([], { form: here }), 't1')).toBeNull();
    expect(
      structureChange(
        tab([], { form: {} }),
        tab([], { form: { sheet: { tabId: 't3', sheetId: 's' } } }),
        't1',
      ),
    ).toBe('form');
  });
});

describe('keepStoredStructure', () => {
  it('lands the content and puts the name, Plan elements and form targets back as stored', () => {
    const stored = tab([board('b1'), card('c1', 'i1'), box('x', 'a')], {
      form: { destination: { tabId: 't1', typeId: 'task', status: 'todo' } },
    });
    const sent = tab([card('c1', 'i9'), box('x', 'b'), board('b2')], {
      name: 'Mine',
      form: { destination: { tabId: 't2', typeId: 'task', status: 'todo' } },
    });
    const kept = keepStoredStructure(sent, stored, 't1');
    expect(kept.name).toBe('Board');
    expect(kept.elements).toEqual([card('c1', 'i1'), box('x', 'b'), board('b1')]);
    expect(kept.form).toEqual(stored.form);
  });

  it('returns the save unchanged when it keeps the structure', () => {
    const stored = tab([board('b1'), box('x', 'a')]);
    const sent = tab([board('b1'), box('x', 'b')]);
    expect(keepStoredStructure(sent, stored, 't1')).toBe(sent);
  });
});

describe('structureRefusal', () => {
  it('answers 403 tab_structure and logs what changed', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const refused = structureRefusal('reach', { documentId: 'D', tabId: 't1' });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe('tab_structure');
    expect(info).toHaveBeenCalledWith('[tabs] tab.structure.refused', {
      documentId: 'D',
      tabId: 't1',
      why: 'reach',
    });
  });
});
