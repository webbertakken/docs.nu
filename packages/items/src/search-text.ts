// A document's cards as content search reads them (docs/specs/013-workspace/content-search.md "What is searched"):
// each live card's title, description and comments, one line each. Cards in the Trash or archived are not found.

import { DESCRIPTION_RICH_FIELD } from './rich-text-field';
import type { Item } from './item';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

function cardTexts(item: Pick<Item, 'fields'>): (string | null)[] {
  const f = item.fields as Record<string, unknown>;
  const rich = Array.isArray(f[DESCRIPTION_RICH_FIELD])
    ? (f[DESCRIPTION_RICH_FIELD] as unknown[])
        .map((r) => (isRecord(r) ? (text(r.text) ?? '') : ''))
        .join('')
    : null;
  const thread =
    isRecord(f.comments) && Array.isArray(f.comments.comments) ? f.comments.comments : [];
  return [
    text(f.title),
    text(f.description),
    text(rich),
    ...thread.map((c) => (isRecord(c) ? text(c.text) : null)),
  ];
}

/** Every live card's texts, a line each, empty ones skipped. */
export function itemsSearchText(items: readonly Pick<Item, 'fields'>[]): string {
  return items
    .filter((i) => i.fields['status'] !== 'trash' && i.fields['archived'] !== true)
    .flatMap(cardTexts)
    .filter((t): t is string => t !== null)
    .join('\n');
}
