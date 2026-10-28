// Who did an event, in words (docs/specs/013-workspace/timeline.md §2, §2.10): from the event
// itself, with no other request.

import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@livedoc/ui';
import { eventPersonName } from './event-person';

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

  it('names nobody for a system event', () => {
    expect(eventPersonName(event({ actorId: null }), ME)).toBeNull();
  });
});
