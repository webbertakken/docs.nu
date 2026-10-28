// What a History entry says (docs/specs/013-workspace/timeline.md §2.10), worked out from the
// feed's own renderer so the two never word an event differently: the reason line, who did it,
// the detail (without a "by ..." the person line already says) and any words to quote.

import type { ReactNode } from 'react';
import type { TimelineCardRender, TimelineEvent } from '@livedoc/ui';
import { eventPersonName } from '@/app/explorer/timeline/event-person';

export type HistoryWords = {
  label: ReactNode;
  who: string | null;
  detail: string | null;
  quote: ReactNode;
};

function detailOf(meta: ReactNode, who: string | null): string | null {
  if (typeof meta !== 'string' || meta.length === 0) return null;
  if (meta.startsWith('by ') || meta === who) return null;
  return meta;
}

export function historyWords(
  event: TimelineEvent,
  card: TimelineCardRender,
  viewerId: string | null,
): HistoryWords {
  const who = eventPersonName(event, viewerId);
  return {
    label: card.label ?? event.title,
    who,
    detail: detailOf(card.meta, who),
    // `undefined` keeps the stored description, `null` shows nothing (the renderer contract).
    quote: card.description === undefined ? event.description : card.description,
  };
}
