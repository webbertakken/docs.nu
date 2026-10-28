// The card a bug report makes on the Bug Tracker's board (docs/specs/016-platform/bug-reports.md "The Bug Tracker
// board"): the title, the details as the card's Details, and the Context, Screenshot, Reporter and Release fields of
// the Bug Report card type, found by label. Severity is left for triage. Pure, so a refile makes the same card.
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_TITLE_MAX,
  ITEM_UNKNOWN_STRING_MAX,
  type ItemFields,
  type ItemTypeDef,
} from '@livedoc/items';
import type { BugReportContext } from './bug-report';
import { bugReportContextLines } from './bug-report-context-lines';

export const BUG_REPORT_TYPE_LABEL = 'Bug Report';

// Who sent a report, as the api resolved it: never from the report itself.
export type BugReporter =
  { kind: 'account' | 'guest'; id: string } | { kind: 'anonymous'; id: null };

// What a card is made from: the report, its reporter and its screenshot's link. It crosses into the Bug Tracker's
// room, and is what a stored report keeps.
export type BugReportFiling = {
  title: string;
  details?: string;
  context?: BugReportContext;
  screenshotUrl?: string;
  reporter: BugReporter;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function findBugReportType(types: readonly ItemTypeDef[]): ItemTypeDef | undefined {
  return types.find((t) => same(t.label, BUG_REPORT_TYPE_LABEL));
}

// The Reporter field: the id in a code span, so it reads as an id and nothing else.
export function reporterLine(reporter: BugReporter): string {
  if (reporter.kind === 'anonymous') return 'Anonymous';
  return `${reporter.kind === 'account' ? 'Account' : 'Guest'} \`${reporter.id}\``;
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function bugReportCard(
  filing: BugReportFiling,
  type: ItemTypeDef,
): { type: string; fields: ItemFields } {
  const fields: ItemFields = { title: cut(filing.title, ITEM_TITLE_MAX) };
  const custom = type.custom ?? [];
  const pieces: { label: string; value: string | undefined }[] = [
    {
      label: 'Context',
      value: filing.context
        ? bugReportContextLines(filing.context)
            .map((l) => `${l.label}: ${l.value}`)
            .join('\n')
        : undefined,
    },
    { label: 'Screenshot', value: filing.screenshotUrl },
    { label: 'Reporter', value: reporterLine(filing.reporter) },
    { label: 'Release', value: filing.context?.release },
  ];
  const leftovers: string[] = [];
  for (const { label, value } of pieces) {
    if (!value) continue;
    const field = custom.find((f) => same(f.label, label));
    if (field) fields[field.id] = cut(value, ITEM_UNKNOWN_STRING_MAX);
    else leftovers.push(`${label}:\n${value}`);
  }
  const description = [filing.details, ...leftovers].filter(Boolean).join('\n\n');
  if (description) fields['description'] = cut(description, ITEM_DESCRIPTION_MAX);
  return { type: type.id, fields };
}
