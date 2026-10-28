// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';

// A full room (docs/specs/015-api/api.md "A room holds at most 100 connections"): the connector's once-per-spell
// call reaches the editor, which warns; the connector keeps trying on its own.

const { room } = vi.hoisted(() => ({ room: { handlers: null as RoomHandlers | null } }));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => null),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: vi.fn(), updateSelf: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

describe('useRoomConnection and a full room', () => {
  it('tells the editor each time the connector says the room is full', async () => {
    const onRoomFull = vi.fn();
    const self = { id: 'user_1', name: 'Me', color: '#0ea5e9', status: 'online' as const };
    const named: Record<string | symbol, unknown> = {
      hydrated: true,
      documentId: 'doc-1',
      documentServerStored: true,
      documentTeamId: null,
      selfParticipant: self,
      sessionShareCode: null,
      lastSeenRef: { current: new Map() },
      selfParticipantRef: { current: self },
      saveBaseline: {
        tabs: { current: [] },
        name: { current: '' },
        journal: { current: { entries: [] } },
      },
      sessionShareCodeRef: { current: null },
      roomRef: { current: null },
      loadedTabIdsRef: { current: new Set<string>() },
      onRoomFull,
    };
    // Every prop the test does not name is a spy.
    const props = new Proxy(named, {
      get: (t, k) => (k in t ? t[k] : (t[k] = vi.fn())),
    }) as unknown as Parameters<typeof useRoomConnection>[0];
    renderHook(() => useRoomConnection(props));
    await waitFor(() => expect(room.handlers).not.toBeNull());
    room.handlers!.onRoomFull!();
    expect(onRoomFull).toHaveBeenCalledOnce();
  });
});
