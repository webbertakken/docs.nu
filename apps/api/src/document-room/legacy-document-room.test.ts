import { describe, expect, it } from 'vitest';
import { LEGACY_PAGE_KEYS, LegacyDocumentRoom } from './legacy-document-room';

function storage(entries: [string, unknown][]) {
  const map = new Map(entries);
  let alarm: number | null = 5;
  return {
    map,
    alarm: () => alarm,
    api: {
      async list(opts: { startAfter?: string; limit?: number }) {
        const keys = [...map.keys()].sort().filter((k) => !opts.startAfter || k > opts.startAfter);
        return new Map(keys.slice(0, opts.limit).map((k) => [k, map.get(k)]));
      },
      async deleteAll() {
        map.clear();
      },
      async deleteAlarm() {
        alarm = null;
      },
    },
  };
}

function legacy(entries: [string, unknown][]) {
  const s = storage(entries);
  const room = new LegacyDocumentRoom({ storage: s.api } as unknown as DurableObjectState, {});
  return { room, s };
}

describe('LegacyDocumentRoom', () => {
  it('hands over every key, a page at a time', async () => {
    const entries: [string, unknown][] = Array.from({ length: LEGACY_PAGE_KEYS + 3 }, (_, i) => [
      `k${String(i).padStart(4, '0')}`,
      { i },
    ]);
    const { room } = legacy(entries);
    const first = await room.exportState(null);
    expect(first.entries).toHaveLength(LEGACY_PAGE_KEYS);
    expect(first.next).toBe(first.entries.at(-1)![0]);
    const second = await room.exportState(first.next);
    expect(second.entries).toHaveLength(3);
    expect(second.next).toBeNull();
    expect([...first.entries, ...second.entries]).toEqual(entries);
  });

  it('clears its storage and alarm', async () => {
    const { room, s } = legacy([['order-state', { epoch: 'e', seq: 1 }]]);
    await room.clear();
    expect(s.map.size).toBe(0);
    expect(s.alarm()).toBeNull();
  });

  it('answers any fetch with 410 room_moved', async () => {
    const { room } = legacy([]);
    const res = await room.fetch(new Request('https://room/ws'));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'room_moved' });
  });
});
