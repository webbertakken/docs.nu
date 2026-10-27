import { describe, expect, it } from 'vitest';
import { LEGACY_HANDOVER_KEY, takeLegacyState, type HandoverStorage } from './legacy-handover';
import type { LegacyStatePage } from './legacy-document-room';

function memory(
  entries: [string, unknown][] = [],
): HandoverStorage & { map: Map<string, unknown>; puts: number } {
  const map = new Map(entries);
  const s = {
    map,
    puts: 0,
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async put(batch: Record<string, unknown>) {
      s.puts++;
      if (Object.keys(batch).length > 128) throw new Error('too many keys');
      for (const [k, v] of Object.entries(batch)) map.set(k, v);
    },
  };
  return s;
}

function legacy(entries: [string, unknown][], pageSize = 2) {
  let cleared = false;
  return {
    get cleared() {
      return cleared;
    },
    async exportState(cursor: string | null): Promise<LegacyStatePage> {
      const start = cursor === null ? 0 : entries.findIndex(([k]) => k === cursor) + 1;
      const page = entries.slice(start, start + pageSize);
      const next = start + pageSize < entries.length ? page.at(-1)![0] : null;
      return { entries: page, next };
    },
    async clear() {
      cleared = true;
    },
  };
}

describe('takeLegacyState', () => {
  it('takes every key verbatim, over the fresh order state, and marks the handover', async () => {
    const room = memory([['order-state', { epoch: 'fresh', seq: 0 }]]);
    const old = legacy([
      ['facilitator', { holder: 'p' }],
      ['ledger:t1:e1', { seq: 4 }],
      ['live-poll', { id: 'q' }],
      ['order-state', { epoch: 'old', seq: 41 }],
      ['sel:abc', { tabId: 't1' }],
    ]);
    expect(await takeLegacyState(room, old, 1000)).toBe(5);
    expect(room.map.get('order-state')).toEqual({ epoch: 'old', seq: 41 });
    expect(room.map.get('ledger:t1:e1')).toEqual({ seq: 4 });
    expect(room.map.get(LEGACY_HANDOVER_KEY)).toEqual({ at: 1000, keys: 5 });
  });

  it('asks nothing once handed over', async () => {
    const room = memory([[LEGACY_HANDOVER_KEY, { at: 1, keys: 0 }]]);
    const old = legacy([['order-state', { epoch: 'old', seq: 1 }]]);
    expect(await takeLegacyState(room, old, 2)).toBeNull();
    expect(room.map.get('order-state')).toBeUndefined();
  });

  it('marks a new document handed over with nothing taken', async () => {
    const room = memory();
    expect(await takeLegacyState(room, legacy([]), 3)).toBe(0);
    expect(room.map.get(LEGACY_HANDOVER_KEY)).toEqual({ at: 3, keys: 0 });
  });

  it('puts in batches the key-value store accepts', async () => {
    const entries: [string, unknown][] = Array.from({ length: 300 }, (_, i) => [
      `k${String(i).padStart(3, '0')}`,
      i,
    ]);
    const room = memory();
    expect(await takeLegacyState(room, legacy(entries, 512), 4)).toBe(300);
    expect(room.map.size).toBe(301);
  });

  it('writes no marker when the legacy room fails, so the next request tries again', async () => {
    const room = memory();
    const old = {
      exportState: async () => {
        throw new Error('unreachable');
      },
      clear: async () => {},
    };
    await expect(takeLegacyState(room, old, 5)).rejects.toThrow('unreachable');
    expect(room.map.has(LEGACY_HANDOVER_KEY)).toBe(false);
  });
});
