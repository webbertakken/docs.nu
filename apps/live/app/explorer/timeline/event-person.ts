// Who did an event, in words (docs/specs/013-workspace/timeline.md §2). The stored row is
// viewer-agnostic, one row serving a whole team, so the pronoun is decided here, against whoever
// is reading. Pure, so the renderers and a document's History (§2.10) name people the same way.

import type { TimelineEvent, TimelineRendererContext } from '@livedoc/ui';

export function snapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function isMine(event: TimelineEvent, ctx: TimelineRendererContext): boolean {
  return Boolean(event.actorId && ctx.viewerId && event.actorId === ctx.viewerId);
}

/** "You", the name the event carries (its author, member, actor or visitor), else "Someone". */
export function actorName(event: TimelineEvent, ctx: TimelineRendererContext): string {
  if (isMine(event, ctx)) return 'You';
  const { snapshot } = event;
  return (
    snapshotString(snapshot, 'authorName') ??
    snapshotString(snapshot, 'memberName') ??
    snapshotString(snapshot, 'actorName') ??
    snapshotString(snapshot, 'visitorName') ??
    'Someone'
  );
}

/** Who did it, from the event alone: as `actorName`, or null for a system event, which names
 *  nobody. */
export function eventPersonName(event: TimelineEvent, viewerId: string | null): string | null {
  return event.actorId ? actorName(event, { viewerId }) : null;
}
