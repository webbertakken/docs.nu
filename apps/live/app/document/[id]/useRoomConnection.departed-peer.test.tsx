// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';

// A peer who leaves takes everything of theirs with them (docs/specs/007-editor/live-app.md "What the editor
// supports today"): their last cursor move, landing in the same frame as the roster that drops them, must not
// come back as a ghost, and their laser trail and camera go too.

const { room } = vi.hoisted(() => ({ room: { handlers: null as RoomHandlers | null } }));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => null),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: vi.fn(), updateSelf: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

let frame: (() => void) | null = null;
beforeEach(() => {
  room.handlers = null;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frame = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frame = null;
  });
});
afterEach(() => vi.unstubAllGlobals());

// A setter whose updates land in a plain value, so the test reads what the editor would hold.
function stateOf<T>(initial: T) {
  let value = initial;
  const set = vi.fn((update: T | ((prev: T) => T)) => {
    value = typeof update === 'function' ? (update as (prev: T) => T)(value) : update;
  });
  return { set, get: () => value };
}

async function mount() {
  const cursors = stateOf(new Map<string, unknown>());
  const lasers = stateOf(new Map<string, unknown>([['gone', { tabId: 't1', points: [] }]]));
  const viewports = stateOf(new Map<string, unknown>([['gone', { tabId: 't1' }]]));
  const self = { id: 'user_1', name: 'Me', color: '#0ea5e9', status: 'online' as const };
  // Every prop the test does not name is a spy, so the hook's other setters run harmlessly.
  const withSpies = <T extends object>(props: T) =>
    new Proxy(props as Record<string | symbol, unknown>, {
      get: (t, k) => (k in t ? t[k] : (t[k] = vi.fn())),
    }) as unknown as Parameters<typeof useRoomConnection>[0];
  renderHook(() =>
    useRoomConnection(
      withSpies({
        hydrated: true,
        documentId: 'doc-1',
        documentServerStored: true,
        enabled: true,
        documentTeamId: null,
        selfParticipant: self,
        sessionShareCode: null,
        lastSeenRef: { current: new Map() },
        selfParticipantRef: { current: self },
        saveBaseline: {
          tabs: { current: [] },
          name: { current: '' },
          journal: { current: { entries: [] } as never },
        },
        sessionShareCodeRef: { current: null },
        roomRef: { current: null },
        markSeen: vi.fn(),
        countAppliedOp: vi.fn(),
        setDocumentName: vi.fn(),
        loadedTabIdsRef: { current: new Set(['t1']) },
        markTabLoaded: vi.fn(),
        setRemoteCursors: cursors.set as never,
        setRemoteLaserTrails: lasers.set as never,
        setRemoteViewports: viewports.set as never,
      }),
    ),
  );
  await waitFor(() => expect(room.handlers).not.toBeNull());
  return { cursors, lasers, viewports };
}

const peer = (id: string) => ({ id, name: id, color: '#f97316', status: 'online' }) as never;
const cursorAt = (x: number) => ({ kind: 'cursor', tabId: 't1', x, y: 0 }) as never;

describe('useRoomConnection and a peer who leaves', () => {
  it("never brings a departed peer's cursor back from the frame their roster landed in", async () => {
    const { cursors } = await mount();
    room.handlers!.onOp('gone', cursorAt(5));
    room.handlers!.onOp('here', cursorAt(1));
    room.handlers!.onPresence([peer('user_1'), peer('here')], []);
    frame?.();
    expect(cursors.get().has('gone')).toBe(false);
    expect(cursors.get().get('here')).toEqual({ tabId: 't1', x: 1, y: 0 });
  });

  it("drops a departed peer's laser trail and camera", async () => {
    const { lasers, viewports } = await mount();
    room.handlers!.onPresence([peer('user_1')], []);
    expect(lasers.get().has('gone')).toBe(false);
    expect(viewports.get().has('gone')).toBe(false);
  });
});
