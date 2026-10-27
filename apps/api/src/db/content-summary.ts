// The listing's view of a document's content (docs/specs/006-document/document-storage.md "The content summary"):
// the small JSON a document's room pushes to `documents.content_summary` (document-room/content-summary.ts builds
// it). Read here by the lists, Home, the shared list and the empty clean-up, which never reach a room.
//
// A summary that is missing (never pushed) reads as unknown: never empty in the Explorer, never moved to the Trash.

import type { DocumentStats } from '@livedoc/api-schema';

export type ContentSummary = {
  v: 1;
  // How many tabs the document holds.
  tabs: number;
  // The element count of the first tab (-1 not yet known), or null with no tab.
  firstTabCount: number | null;
  // Each tab's element count (-1 not yet known): a tab-scoped share's row shows its own tab.
  tabCounts: Record<string, number>;
  // The Details view's columns (docs/specs/013-workspace/explorer-details-view.md), null while any tab is uncounted.
  stats: DocumentStats | null;
  // Whether any tab holds content, by the empty clean-up's test (docs/specs/013-workspace/empty-document-cleanup.md).
  hasContent: boolean;
};

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= -1;

// A D1 value as a summary, or null for absent or unreadable (logged: a room wrote something this does not read).
export function readContentSummary(raw: string | null | undefined): ContentSummary | null {
  if (raw == null) return null;
  try {
    const v = JSON.parse(raw) as Partial<ContentSummary>;
    if (
      v.v === 1 &&
      isCount(v.tabs) &&
      (v.firstTabCount === null || isCount(v.firstTabCount)) &&
      typeof v.tabCounts === 'object' &&
      v.tabCounts !== null &&
      typeof v.hasContent === 'boolean'
    ) {
      return v as ContentSummary;
    }
  } catch {
    // Falls through to the warning.
  }
  console.warn('[content-summary] unreadable', raw.slice(0, 120));
  return null;
}

// The `first_tab_count` column of a document list (docs/specs/006-document/document-snapshots.md): the element count
// of the document's first tab, or of `scopeTabSql`'s tab when that is not null. NULL = no tab (or a scope tab the
// document does not hold), -1 = not yet known, which is also what a document whose summary has not landed reads as.
export function firstTabCountSql(documentIdSql: string, scopeTabSql: string | null = null): string {
  const counted = scopeTabSql
    ? `CASE WHEN ${scopeTabSql} IS NULL THEN json_extract(cs.content_summary, '$.firstTabCount')
            ELSE json_extract(cs.content_summary, '$.tabCounts.' || json_quote(${scopeTabSql})) END`
    : `json_extract(cs.content_summary, '$.firstTabCount')`;
  return `(SELECT CASE WHEN cs.content_summary IS NULL THEN -1 ELSE ${counted} END
             FROM documents cs WHERE cs.id = ${documentIdSql}) AS first_tab_count`;
}

// A document's Details-view stats as the `doc_stats` column readDocumentStats reads: JSON text, or NULL.
export function docStatsSql(documentIdSql: string): string {
  return `(SELECT json_extract(cs.content_summary, '$.stats')
             FROM documents cs WHERE cs.id = ${documentIdSql}) AS doc_stats`;
}

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
