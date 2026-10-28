// Who did an event, in words (docs/specs/013-workspace/timeline.md §2). The stored row is
// viewer-agnostic, one row serving a whole team, so the pronoun is decided here, against whoever
// is reading. Pure, so the renderers and a document's History (§2.10) name people the same way.
//
// A document's feed sends every actor but the reader as a null id (§6.1), so a null id is not
// proof of a system event: the name the event carries still says who it was.

import type { TimelineEvent, TimelineRendererContext } from '@livedoc/ui';

export function snapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function isMine(event: TimelineEvent, ctx: TimelineRendererContext): boolean {
  return Boolean(event.actorId && ctx.viewerId && event.actorId === ctx.viewerId);
}

/** The name the event carries for whoever did it: its author, member, actor or visitor. */
function snapshotName(event: TimelineEvent): string | null {
  const { snapshot } = event;
  return (
    snapshotString(snapshot, 'authorName') ??
    snapshotString(snapshot, 'memberName') ??
    snapshotString(snapshot, 'actorName') ??
    snapshotString(snapshot, 'visitorName')
  );
}

/** "You", the name the event carries, else "Someone". */
export function actorName(event: TimelineEvent, ctx: TimelineRendererContext): string {
  if (isMine(event, ctx)) return 'You';
  return snapshotName(event) ?? 'Someone';
}

/** Who did it, from the event alone: "You", the name it carries, "Someone" for an actor it does
 *  not name, or null when it names nobody at all (a system event, or a hidden id with no name). */
export function eventPersonName(event: TimelineEvent, viewerId: string | null): string | null {
  if (isMine(event, { viewerId })) return 'You';
  return snapshotName(event) ?? (event.actorId ? 'Someone' : null);
}

/** One key per person, as a document's History tells them apart (§2.10): the reader by their id,
 *  everyone else by the name the event carries, an unnamed actor by their id, else null. */
export function eventPersonKey(event: TimelineEvent, viewerId: string | null): string | null {
  if (isMine(event, { viewerId })) return `id:${event.actorId}`;
  const name = snapshotName(event);
  if (name) return `name:${name}`;
  return event.actorId ? `id:${event.actorId}` : null;
}
