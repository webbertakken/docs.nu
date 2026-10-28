// What a History entry says (docs/specs/013-workspace/timeline.md §2.10): the reason in words,
// who did it, the detail without a "by ..." the person line already says, and any quoted words.

import { describe, expect, it } from 'vitest';
import type { TimelineCardRender, TimelineEvent } from '@livedoc/ui';
import { historyWords } from './history-words';

const ME = 'me';

function event(over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'e',
    sourceType: 'document',
    sourceId: 'd1',
    eventType: 'document_moved',
    title: 'Document Moved',
    description: 'Payments → Launches',
    occurredAt: 1_700_000_000_000,
    actorId: 'ada',
    snapshot: { documentId: 'd1', documentName: 'Payments', authorName: 'Ada Lovelace' },
    ...over,
  };
}

const card = (over: Partial<TimelineCardRender> = {}): TimelineCardRender => ({
  icon: null,
  description: null,
  ...over,
});

describe('historyWords', () => {
  it('says the stored reason, the person and the renderer’s detail', () => {
    expect(historyWords(event(), card({ meta: 'To Launches' }), ME)).toEqual({
      label: 'Document Moved',
      who: 'Ada Lovelace',
      detail: 'To Launches',
      quote: null,
    });
  });

  it('keeps a renderer’s own reason over the stored one', () => {
    expect(historyWords(event(), card({ label: 'Filed' }), ME).label).toBe('Filed');
  });

  it('drops a detail that only says who, which the person line already does', () => {
    expect(historyWords(event(), card({ meta: 'by Ada Lovelace' }), ME).detail).toBeNull();
    expect(historyWords(event(), card({ meta: 'by you' }), ME).detail).toBeNull();
    expect(historyWords(event(), card({ meta: 'Ada Lovelace' }), ME).detail).toBeNull();
  });

  it('quotes a comment’s stored words when the renderer keeps them', () => {
    const comment = event({ eventType: 'comment_added', description: 'Ship it?' });
    expect(historyWords(comment, card({ description: undefined }), ME).quote).toBe('Ship it?');
  });

  it('quotes the renderer’s own words, and nothing when it clears them', () => {
    expect(historyWords(event(), card({ description: 'Write the brief' }), ME).quote).toBe(
      'Write the brief',
    );
    expect(historyWords(event(), card({ description: null }), ME).quote).toBeNull();
  });

  it('is You for the reader and names nobody for a system event', () => {
    expect(historyWords(event({ actorId: ME }), card(), ME).who).toBe('You');
    expect(historyWords(event({ actorId: null }), card(), ME).who).toBeNull();
  });
});
