// Optimistic writes to one field of one thing (a document's name, its folder), kept as layers
// (docs/specs/013-workspace/folders.md "Refused changes"). Each write shows at once as a layer over the
// stored value; the api's answer settles that layer alone. A refused write takes back only its own layer,
// so a newer write to the same field stays on screen: rename to B (slow), then to C, and B's refusal
// leaves C showing, never the name from before B.

export type OptimisticLayer<V> = { readonly id: number; readonly value: V };

export type OptimisticLayers<V> = {
  /** The value the api holds as far as this page knows. */
  readonly base: V;
  /** Writes still waiting on the api, oldest first. */
  readonly layers: readonly OptimisticLayer<V>[];
};

export const OptimisticLayers = {
  /** A new write on top. `current` is the shown value, the base when nothing is waiting yet. */
  begin: <V>(
    state: OptimisticLayers<V> | undefined,
    current: V,
    layer: OptimisticLayer<V>,
  ): OptimisticLayers<V> => ({
    base: state?.base ?? current,
    layers: [...(state?.layers ?? []), layer],
  }),

  /** The api took the write: it is the stored value now, and older writes still waiting are behind it. */
  accept: <V>(state: OptimisticLayers<V>, id: number): OptimisticLayers<V> => {
    const at = state.layers.findIndex((l) => l.id === id);
    if (at === -1) return state;
    return { base: state.layers[at]!.value, layers: state.layers.slice(at + 1) };
  },

  /** The api refused the write: only its own layer goes. */
  refuse: <V>(state: OptimisticLayers<V>, id: number): OptimisticLayers<V> => ({
    base: state.base,
    layers: state.layers.filter((l) => l.id !== id),
  }),

  /** What the field shows: the newest write still waiting, else the stored value. */
  shown: <V>(state: OptimisticLayers<V>): V => state.layers.at(-1)?.value ?? state.base,

  settled: <V>(state: OptimisticLayers<V>): boolean => state.layers.length === 0,
} as const;

/** One field's layers for many things, keyed by the thing's id. */
export type OptimisticField<V> = {
  /** Starts a write; answers its id, to settle it with. */
  begin: (key: string, current: V, value: V) => number;
  accept: (key: string, id: number) => void;
  /** Settles a refused write; answers what the field shows now. */
  refuse: (key: string, id: number) => V | undefined;
};

export function createOptimisticField<V>(): OptimisticField<V> {
  const byKey = new Map<string, OptimisticLayers<V>>();
  let nextId = 0;
  const settle = (key: string, next: OptimisticLayers<V>) => {
    if (OptimisticLayers.settled(next)) byKey.delete(key);
    else byKey.set(key, next);
  };
  return {
    begin: (key, current, value) => {
      const id = ++nextId;
      byKey.set(key, OptimisticLayers.begin(byKey.get(key), current, { id, value }));
      return id;
    },
    accept: (key, id) => {
      const state = byKey.get(key);
      if (state) settle(key, OptimisticLayers.accept(state, id));
    },
    refuse: (key, id) => {
      const state = byKey.get(key);
      if (!state) return undefined;
      const next = OptimisticLayers.refuse(state, id);
      settle(key, next);
      return OptimisticLayers.shown(next);
    },
  };
}
