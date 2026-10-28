import { describe, expect, it, vi } from 'vitest';

const debugLog = vi.hoisted(() => vi.fn());
vi.mock('@/lib/debug-log', () => ({ debugLog }));

import { initialStartGroup } from './initial-start-group';

const GROUPS = ['recommended', 'boards', 'sheets', 'forms'] as const;

describe('initialStartGroup', () => {
  it('opens on Recommended when nothing was handed over', () => {
    expect(initialStartGroup(null, GROUPS)).toBe('recommended');
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('opens on a handed group the panel has', () => {
    expect(initialStartGroup('sheets', GROUPS)).toBe('sheets');
    expect(debugLog).toHaveBeenCalledWith('[start] group=sheets');
  });

  it('opens an unknown group on Recommended, and says so', () => {
    expect(initialStartGroup('spreadsheets', GROUPS)).toBe('recommended');
    expect(debugLog).toHaveBeenCalledWith('[start] group-unknown');
  });
});
