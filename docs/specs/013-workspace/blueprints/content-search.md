# Blueprint: content search

Derived from [Content search](../content-search.md); the index is fed as in
[Document storage](../../006-document/blueprints/document-storage.md) ("The outbox").
Name matching is the fuzzy title matcher's ([Explorer filters](explorer-filters.md), `@livedoc/explorer-lens`
`title-match.ts`); this blueprint reuses its folding and word splitting and never re-implements them.

## Domain and naming

| Term            | Identifier                                                                                                                                                                        | Never            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Search text     | `tabSearchText(tab, sheets)` (`@livedoc/document-views` `search-text.ts`); `itemsSearchText(items)` (`@livedoc/items` `search-text.ts`)                                           | index text, blob |
| Index row       | D1 `content_search` row, key `(document_id, tab_id)`; items under `tab_id = '~items'` (`ITEMS_SEARCH_KEY`)                                                                        | doc row          |
| Full-text index | D1 `content_search_fts` (FTS5, external content `content_search`)                                                                                                                 | search table     |
| Folded text     | `foldSearchText(text)` = `foldText` then every run of non letter or digit to one space, trimmed; query words by `searchQueryWords(q)` (`@livedoc/explorer-lens` `search-fold.ts`) | normalised       |
| Query           | `ContentQuery = { long: { word: string; trigrams: string[] }[]; short: string[] }` from `compileContentQuery(q)`                                                                  | search params    |
| Content match   | `ContentMatch = { documentId; tabId: string \| null; tabName: string \| null; snippet: { text: string; marks: [number, number][] } }`                                             | hit, result      |

## Behaviour and state

### Writing the index (from the room's drain)

- Tab unit, tab present: `text = cap(tabSearchText(tab, sheetSearchInputs(referenced)), SEARCH_TEXT_MAX_CHARS)`, where
  `referenced` are the sheets its `sheet_refs` name and `sheetSearchInputs` is `@livedoc/sheets` `search-inputs.ts`;
  `INSERT INTO content_search (document_id, tab_id, tab_name, text, folded) VALUES (...) ON CONFLICT (document_id,
tab_id) DO UPDATE SET tab_name = excluded.tab_name, text = excluded.text, folded = excluded.folded
WHERE content_search.text IS NOT excluded.text OR content_search.tab_name IS NOT excluded.tab_name`, guarded by
  `EXISTS (SELECT 1 FROM documents WHERE id = ?)`.
- Tab unit, tab gone: `DELETE FROM content_search WHERE document_id = ? AND tab_id = ?`.
- Items unit: the same with `tab_id = '~items'`, `tab_name = ''`; no items deletes the row.
- An empty search text deletes the row rather than storing `''`.
- `cap` cuts at `SEARCH_TEXT_MAX_CHARS` UTF-16 units, backing off a lone high surrogate.
- Triggers keep `content_search_fts` in step (FTS5's external-content pattern): `AFTER INSERT` inserts, `AFTER
DELETE` writes the `'delete'` command row, `AFTER UPDATE OF text` does both. A purge's cascade from `documents`
  fires the delete trigger.

### `tabSearchText(tab, sheetInputs)`

Lines joined with `\n`, in order: `tab.name`; for each element in the tab's element order `elementFindTexts(el)`; each
article's text (a paragraph's or list's runs joined, a code block's text) in `tab.articles` order; each page's `name`;
the form's heading, description, each section's title and description, each question's prompt, help and options;
then `sheetInputs`, the caller's list of the inputs of the cells of the sheets the tab references that are not
formulas, row-major. Empty strings skipped; a malformed body reads as nothing. The cards' text,
`itemsSearchText(items)`, is each live card's (not in the Trash, not archived) title, description, rich description
and comments.

### Reading (`GET /api/search/content?q=<text>`)

1. Identity: the reader as the lists resolve it (`resolveOwner`, account ids, joined teams); no caller: 400 (`missingAuth`, as every route).
2. `SEARCH_RATE_LIMITER.limit({ key: owner })`; refused: 429 `rate_limited`.
3. `q` cut to `SEARCH_QUERY_MAX_CHARS`; `compileContentQuery(q)`: words from `compileTitleQuery([q]).words`; a word of
   3 or more characters is long, its trigrams every 3-character window, deduplicated across the query and capped at
   `SEARCH_TRIGRAMS_MAX` in word order; shorter words are short. No words: 200 `{ matches: [] }`.
4. With long words, one statement:
   - `visible` is the lists' CTE (`VISIBLE_DOCUMENTS_CTES`, `db/document-visibility.ts`, binds `?1` owner,
     `?2` now): own, joined teams', shared with the reader, live only, with `scope_tab_id` for a tab-scoped link.
   - `hits`: `content_search_fts MATCH ?` (the trigrams quoted and joined with `OR`), joined to `content_search`
     and `visible` (`v.scope_tab_id IS NULL OR v.scope_tab_id = s.tab_id`, and `s.tab_id <> '~items'` when scoped),
     ordered by `bm25(content_search_fts)`, at most `SEARCH_CANDIDATES` rows; no `snippet()` (below).
   - Keep a hit when, for every long word, at least `SEARCH_MIN_TRIGRAM_SHARE` of its trigrams occur in
     `folded` (`instr`), and every short word starts a word of `' ' || folded`.
   - `matched` = the count of all query trigrams in `folded`.
   - One row per document: `ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY rank, matched DESC)`.
   - Order: `rank`, then `matched DESC`, then `documents.saved_at DESC`; at most `SEARCH_RESULTS_MAX`.
5. Short words only: the same `visible` join over `content_search` with every short word a word start, ordered by
   `saved_at DESC`, at most `SEARCH_RESULTS_MAX`.
6. Each answered row's snippet is cut from its `text` in the Worker (`snippetAround`): every word of the text whose
   folded form answers a query word (a short word starts it; a long word has at least the minimum share of its
   trigrams in it) is marked, whole for a long word, the typed start for a short one; `trimSnippet` then cuts to at
   most `SNIPPET_MAX_CHARS` around the first mark, at word boundaries, with `…`. SQLite's `snippet()` would mark
   trigram fragments and walk every candidate's text: over 2,000 rows of 8 KB a search took 547 ms with it in the
   candidates and 21 ms without.
7. Answer 200 `{ matches: ContentMatch[] }`; `tabId` and `tabName` null for the `~items` row.

### Presentation

Not here: the Ctrl K search's own spec and blueprint read `ContentSearchDTO` and decide how matches show, when the
request fires and what it counts.

## Interfaces and contracts

- `GET /api/search/content?q=` → `ContentSearchDTO = { matches: ContentMatchDTO[] }` in `@livedoc/api-schema`;
  400 when `q` is missing or there is no caller; 429 `rate_limited`; 503 `search_unavailable` when
  the statement fails. A missing caller is 400 (`missingAuth`, as every route). Listed in the OpenAPI manifest; read-only tokens may call it.
- D1 migration `0104_content_search.sql`:

```sql
CREATE TABLE content_search (
  rowid       INTEGER PRIMARY KEY,
  document_id TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id      TEXT    NOT NULL,
  tab_name    TEXT    NOT NULL,
  text        TEXT    NOT NULL,
  folded      TEXT    NOT NULL,
  UNIQUE (document_id, tab_id)
);
CREATE VIRTUAL TABLE content_search_fts USING fts5(
  text, content = 'content_search', content_rowid = 'rowid',
  tokenize = 'trigram remove_diacritics 1'
);
-- content_search_ai, content_search_ad, content_search_au: the external-content triggers.
```

- `wrangler.toml`: `SEARCH_RATE_LIMITER`, `type = "ratelimit"`, the next free namespace id in production's range and
  its preview twin, `simple = { limit = 120, period = 60 }`; the preview generator maps it.

## Data and persistence

- `content_search` holds **derived content**: readable only through the access-filtered read; dropped and refilled by
  any drain; never exported by the api.
- D1 export refuses databases with virtual tables: an export drops `content_search_fts` and its triggers first and
  recreates them after (`INSERT INTO content_search_fts (content_search_fts) VALUES ('rebuild')`).
- Production D1 support for the trigram tokenizer with `remove_diacritics` is proven on a preview's D1 (migrated by
  CI), never by a write to production.

## Errors and edge cases

| Case                                          | Handling                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `q` only punctuation                          | 200, no matches; no statement runs                               |
| A word longer than the trigram cap allows     | its later trigrams dropped; the share counts the kept ones       |
| FTS statement fails                           | 503 `search_unavailable`, `[content-search] failed error=<name>` |
| A reader's link lapses between write and read | `visible` drops it                                               |
| Tab-scoped reader                             | only that tab's row; never `~items`                              |
| This Browser documents                        | never sent; name matching only                                   |
| Text past the cap                             | not found; nothing signalled                                     |

## Security and trust

- Every read joins `visible`; there is no path that reads `content_search` without it (`content-search.ts` is the only
  module naming the table outside the drain).
- The query reaches SQL only as bound values; trigrams are letters and digits after folding, quoted in the MATCH
  string, so no FTS5 syntax passes through.
- Logs carry the query's word count and trigram count, never the words.

## Performance and limits

- Measured (node:sqlite with FTS5 trigram, a throwaway bench): 20,000 rows of 8 KB from 1,000 owners, a reader with
  200 documents, every row holding the query's words: a 3-word query 55 ms, a typo'd word 53 ms, a short word 7 ms;
  over 2,000 rows, 26 ms, 28 ms and 7 ms. The OR of trigrams matches every row holding any of them, so the cost grows
  with the whole index, not the reader's share of it; docs.nu holds 16 KB.
- Index size: the trigram index is about 3 to 4 times the text; at the cap, a tab adds at most about 160 KB.
- A drain rewrites a tab's row only when its text changed (the upsert's `WHERE`).

## Observability

| Fingerprint                                                          | When                 |
| -------------------------------------------------------------------- | -------------------- |
| `[content-search] query words=<n> trigrams=<t> matches=<m> ms=<d>`   | every read           |
| `[content-search] failed error=<name>`                               | a read fails         |
| `[content-search] indexed id=<id> tab=<tab> chars=<n> capped=<bool>` | a drain writes a row |

## Testing

| Rule                                                          | Test                                   |
| ------------------------------------------------------------- | -------------------------------------- |
| Search text covers every listed source, in order              | `search-text.test.ts` (document-views) |
| Items text                                                    | `search-text.test.ts` (items)          |
| Substring, accent folding, typo by trigram share, short words | `content-search.test.ts`               |
| Every word satisfied in one tab                               | `content-search.test.ts`               |
| Access: own, team, shared, scoped tab, trashed, lapsed link   | `content-search.test.ts`               |
| One row per document; ranking order                           | `content-search.test.ts`               |
| Snippet marks and trim                                        | `content-snippet.test.ts`              |
| Index triggers and cascade                                    | `content-search-index.test.ts`         |
| Route: 400, 429, 503, 404                                     | `content-search-route.test.ts`         |

## Constants and configuration

| Constant                   | Value    | Provenance                                     | Safe range       |
| -------------------------- | -------- | ---------------------------------------------- | ---------------- |
| `SEARCH_TEXT_MAX_CHARS`    | 32,768   | spec                                           | 4,096 to 262,144 |
| `SEARCH_QUERY_MAX_CHARS`   | 512      | the lens's cap                                 | fixed            |
| `SEARCH_TRIGRAMS_MAX`      | 32       | spec                                           | 8 to 64          |
| `SEARCH_MIN_TRIGRAM_SHARE` | 0.5      | spec ("at least half")                         | 0.3 to 0.8       |
| `SEARCH_RESULTS_MAX`       | 50       | spec                                           | 10 to 200        |
| `SEARCH_CANDIDATES`        | 500      | ten times the results, before the share filter | 100 to 2,000     |
| `SNIPPET_MAX_CHARS`        | 160      | spec ("about 160 characters")                  | 80 to 240        |
| Rate limit                 | 120/60 s | spec                                           | 30 to 600        |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D179 to D184.
