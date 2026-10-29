// What a tab is made as (docs/specs/007-editor/templates-by-mode.md "A template's mode"): a template, a blank, the New
// Document wizard's choice, a recorded creation intent, a default folder and the Explorer's Opens in all say it. One of
// the three editor modes, a Workshop (Structured with the Workshop control on) or Plan (Plan tabs). A choice of what to
// make, never a mode the editor runs in.
import {
  isLegacyWorkshopOpensIn,
  opensInOf,
  parseEditorMode,
  workshopOf,
  type EditorMode,
} from './editor-mode';

export const TAB_OPENING_CATALOGUE = [
  { id: 'draw', label: 'Sketch' },
  { id: 'diagram', label: 'Structured' },
  { id: 'pages', label: 'Pages' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'plan', label: 'Plan' },
] as const satisfies readonly { id: string; label: string }[];

export type TabOpening = (typeof TAB_OPENING_CATALOGUE)[number]['id'];

export const TAB_OPENINGS: readonly TabOpening[] = TAB_OPENING_CATALOGUE.map((o) => o.id);

/** "Workshop": the opening's name as the interface shows it. */
export function tabOpeningLabel(opening: TabOpening): string {
  return TAB_OPENING_CATALOGUE.find((o) => o.id === opening)!.label;
}

export function isTabOpening(v: unknown): v is TabOpening {
  return TAB_OPENINGS.includes(v as TabOpening);
}

/** A stored opening as today's id: a current one as it is, Facilitate as Workshop, an old name of Pages as Pages,
 *  anything else undefined. Read every stored opening (an intent, a `/new?mode=` link, a filter) through this. */
export function parseTabOpening(v: unknown): TabOpening | undefined {
  if (isTabOpening(v)) return v;
  if (isLegacyWorkshopOpensIn(v)) return 'workshop';
  return parseEditorMode(v);
}

/** The mode a tab made as `opening` opens in: a Workshop opens in Structured. */
export function openingEditorMode(opening: TabOpening): EditorMode {
  return opening === 'workshop' ? 'diagram' : opening;
}

/** Whether a tab made as `opening` opens with the Workshop control on. */
export function openingWorkshop(opening: TabOpening): boolean {
  return opening === 'workshop';
}

/** What a tab is, as an opening: a Structured tab with the Workshop control on is a Workshop. */
export function tabOpeningOf(tab: Parameters<typeof workshopOf>[0]): TabOpening {
  const mode = opensInOf(tab);
  return mode === 'diagram' && workshopOf(tab) ? 'workshop' : mode;
}
