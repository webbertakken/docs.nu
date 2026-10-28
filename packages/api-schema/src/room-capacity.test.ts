import { describe, expect, it } from 'vitest';
import { ROOM_FULL_CLOSE, ROOM_MAX_CONNECTIONS, roomIsFull } from './room-capacity';
import { ACCESS_CHANGED_CLOSE, WORKBENCH_ENDED_CLOSE } from './room-messages';
import { DOCUMENT_TRASHED_CLOSE } from './trash';

// docs/specs/015-api/api.md "A room holds at most 100 connections".

describe('room capacity', () => {
  it('admits the 100th connection and turns the 101st away', () => {
    expect(ROOM_MAX_CONNECTIONS).toBe(100);
    expect(roomIsFull(99)).toBe(false);
    expect(roomIsFull(100)).toBe(true);
  });

  it('closes in the application range, clear of the codes the room already uses', () => {
    expect(ROOM_FULL_CLOSE).toBeGreaterThanOrEqual(4000);
    expect(ROOM_FULL_CLOSE).toBeLessThan(5000);
    // 4003 is a changed share link.
    expect([
      4003,
      DOCUMENT_TRASHED_CLOSE,
      ACCESS_CHANGED_CLOSE,
      WORKBENCH_ENDED_CLOSE,
    ]).not.toContain(ROOM_FULL_CLOSE);
  });
});
