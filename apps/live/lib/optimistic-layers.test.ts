import { describe, expect, it } from 'vitest';
import { createOptimisticField, OptimisticLayers } from './optimistic-layers';

// docs/specs/013-workspace/folders.md "Refused changes": a refused write takes back only its own layer.
describe('OptimisticLayers', () => {
  const twoWrites = () =>
    OptimisticLayers.begin(OptimisticLayers.begin(undefined, 'A', { id: 1, value: 'B' }), 'B', {
      id: 2,
      value: 'C',
    });

  it('shows the newest write over the stored value', () => {
    expect(OptimisticLayers.shown(twoWrites())).toBe('C');
    expect(twoWrites().base).toBe('A');
  });

  it('keeps a newer write when an older one is refused', () => {
    expect(OptimisticLayers.shown(OptimisticLayers.refuse(twoWrites(), 1))).toBe('C');
  });

  it('falls back to the older write still waiting when the newer one is refused', () => {
    expect(OptimisticLayers.shown(OptimisticLayers.refuse(twoWrites(), 2))).toBe('B');
  });

  it('shows the stored value once every write is refused', () => {
    const state = OptimisticLayers.refuse(OptimisticLayers.refuse(twoWrites(), 1), 2);
    expect(OptimisticLayers.shown(state)).toBe('A');
    expect(OptimisticLayers.settled(state)).toBe(true);
  });

  it('makes an accepted write the stored value, so a later refusal falls back to it', () => {
    const state = OptimisticLayers.refuse(OptimisticLayers.accept(twoWrites(), 1), 2);
    expect(OptimisticLayers.shown(state)).toBe('B');
  });

  it('drops older writes behind an accepted newer one', () => {
    const state = OptimisticLayers.accept(twoWrites(), 2);
    expect(state).toEqual({ base: 'C', layers: [] });
    expect(OptimisticLayers.shown(OptimisticLayers.refuse(state, 1))).toBe('C');
  });
});

describe('createOptimisticField', () => {
  it('keeps each key apart and forgets a settled one', () => {
    const field = createOptimisticField<string | null>();
    const a1 = field.begin('a', null, 'f1');
    const b1 = field.begin('b', 'f2', null);
    const a2 = field.begin('a', 'f1', 'f3');
    expect(field.refuse('a', a1)).toBe('f3');
    expect(field.refuse('b', b1)).toBe('f2');
    field.accept('a', a2);
    expect(field.refuse('a', a2)).toBeUndefined();
  });
});
