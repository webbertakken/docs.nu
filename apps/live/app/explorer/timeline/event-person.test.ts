// Who did an event, in words (docs/specs/013-workspace/timeline.md §2, §2.10): from the event
// itself, with no other request.

import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@livedoc/ui';
import { eventPersonKey, eventPersonName } from './event-person';

const ME = 'me';

function event(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'e',
    sourceType: 'document',
    sourceId: 'd1',
    eventType: 'comment_added',
    title: 'Comment Added',
    description: null,
    occurredAt: 1_700_000_000_000,
    actorId: ME,
    snapshot: {},
    ...over,
  };
}

describe('eventPersonName', () => {
  it('is You for the reader', () => {
    expect(eventPersonName(event({ actorId: ME, snapshot: { authorName: 'Me' } }), ME)).toBe('You');
  });

  it('reads the name the event carries, whichever kind of person it is', () => {
    for (const key of ['authorName', 'memberName', 'actorName', 'visitorName']) {
      expect(eventPersonName(event({ actorId: 'ada', snapshot: { [key]: 'Ada' } }), ME)).toBe(
        'Ada',
      );
    }
  });

  it('is Someone for a person the event does not name', () => {
    expect(eventPersonName(event({ actorId: 'ada' }), ME)).toBe('Someone');
  });

  it('names someone a document’s feed hid the id of, by the name the event carries', () => {
    expect(eventPersonName(event({ actorId: null, snapshot: { authorName: 'Ada' } }), ME)).toBe(
      'Ada',
    );
  });

  it('names nobody for an event that carries neither an id nor a name', () => {
    expect(eventPersonName(event({ actorId: null }), ME)).toBeNull();
  });
});

describe('eventPersonKey', () => {
  it('keys the reader on their id, whatever name an event gives them', () => {
    expect(eventPersonKey(event({ actorId: ME, snapshot: { authorName: 'Me' } }), ME)).toBe(
      eventPersonKey(event({ actorId: ME }), ME),
    );
  });

  it('keys everyone else on the name the event carries', () => {
    const hidden = event({ actorId: null, snapshot: { authorName: 'Ada' } });
    const shown = event({ actorId: 'ada', snapshot: { authorName: 'Ada' } });
    expect(eventPersonKey(hidden, ME)).toBe(eventPersonKey(shown, ME));
    expect(eventPersonKey(hidden, ME)).not.toBe(
      eventPersonKey(event({ actorId: null, snapshot: { authorName: 'Grace' } }), ME),
    );
  });

  it('keys an unnamed actor on their id, and no one at all on nothing', () => {
    expect(eventPersonKey(event({ actorId: 'ada' }), ME)).toBe('id:ada');
    expect(eventPersonKey(event({ actorId: null }), ME)).toBeNull();
  });
});
