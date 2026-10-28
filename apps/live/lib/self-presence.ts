// The person's presence colour, as Settings shows and changes it (docs/specs/014-identity/auth-and-guest-access.md
// "Account settings"). The colour is the participant record's: the Colour row saves it, and announces the change so
// the profile card and an open editor take it at once, without a reload.
import { PARTICIPANT_COLORS } from './identity';

// The presence colours' names, in PARTICIPANT_COLORS' order: what the Colour row and the card's chip say.
const PRESENCE_COLOUR_NAMES: Record<string, string> = Object.fromEntries(
  ['Sky', 'Emerald', 'Amber', 'Red', 'Violet', 'Pink', 'Teal', 'Orange', 'Indigo', 'Lime'].map(
    (name, i) => [PARTICIPANT_COLORS[i]!, name],
  ),
);

/** A presence colour's name ("Sky"); "Custom" for one off the palette. */
export function presenceColourName(colour: string): string {
  return PRESENCE_COLOUR_NAMES[colour.toLowerCase()] ?? 'Custom';
}

export const SELF_COLOUR_EVENT = 'livedoc:self-colour';

// `color` null: no colour chosen yet (Automatic; one is given when the person first opens a document).
export type SelfColourChange = { id: string; color: string | null };

/** Tell this page the participant `id` now shows in `color` (null: Automatic again). */
export function announceSelfColour(id: string, color: string | null): void {
  window.dispatchEvent(
    new CustomEvent<SelfColourChange>(SELF_COLOUR_EVENT, { detail: { id, color } }),
  );
}

/** Hear every change announced on this page; returns the unsubscribe. */
export function onSelfColour(listener: (change: SelfColourChange) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<SelfColourChange>).detail);
  window.addEventListener(SELF_COLOUR_EVENT, handler);
  return () => window.removeEventListener(SELF_COLOUR_EVENT, handler);
}
