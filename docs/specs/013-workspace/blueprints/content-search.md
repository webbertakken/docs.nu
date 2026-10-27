# Blueprint: content search

Derived from [Content search](../content-search.md); the index is fed as in
[Document storage](../../006-document/blueprints/document-storage.md) ("The outbox").
Name matching is the fuzzy title matcher's ([Explorer filters](explorer-filters.md), `@livedoc/explorer-lens`
`title-match.ts`); this blueprint reuses its folding and word splitting and never re-implements them.

## Domain and naming

| Term            | Identifier                                                                                                                              | Never            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Search text     | `tabSearchText(tab, sheets)` (`@livedoc/document-views` `search-text.ts`); `itemsSearchText(items)` (`@livedoc/items` `search-text.ts`) | index text, blob |
| Index row       | D1 `content_search` row, key `(document_id, tab_id)`; items under `tab_id = '~items'` (`ITEMS_SEARCH_KEY`)                              | doc row          |
| Full-text index | D1 `content_search_fts` (FTS5, external content `content_search`)                                                                       | search table     |
| Folded text     | `foldSearchText(text)` = `foldText` then every run of non letter or digit to one space, trimmed (`@livedoc/explorer-lens`)              | normalised       |
| Query           | `ContentQuery = { long: { word: string; trigrams: string[] }[]; short: string[] }` from `compileContentQuery(q)`                        | search params    |
| Content match   | `ContentMatch = { documentId; tabId: string \| null; tabName: string \| null; snippet: { text: string; marks: [number, number][] } }`   | hit, result      |

## Behaviour and state

### Writing the index (from the room's drain)

- Tab unit, tab present: `text = cap(tabSearchText(tab, sheetsOf(tab)), SEARCH_TEXT_MAX_CHARS)`;
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

### `tabSearchText(tab, sheets)`

Lines joined with `\n`, in order: `tab.name`; for each element in reading order (`readingOrder`, document-views)
`elementFindTexts(el)`; each article's text (its blocks' text runs) in `tab.articles` order; each page's title in
`tab.pages`; the form's title, each question's text and each choice (`tab.form`); for each sheet the tab references,
each cell's `input` that is not a formula (a formula's result is never stored), row-major. Empty strings skipped.

### Reading (`GET /api/search/content?q=<text>`)

1. Identity: the reader as the lists resolve it (`resolveOwner`, account ids, joined teams); no caller: 401.
2. `SEARCH_RATE_LIMITER.limit({ key: owner })`; refused: 429 `rate_limited`.
3. `q` cut to `SEARCH_QUERY_MAX_CHARS`; `compileContentQuery(q)`: words from `compileTitleQuery([q]).words`; a word of
   3 or more characters is long, its trigrams every 3-character window, deduplicated across the query and capped at
   `SEARCH_TRIGRAMS_MAX` in word order; shorter words are short. No words: 200 `{ matches: [] }`.
4. With long words, one statement:
   - `visible` is the lists' CTE (`VISIBLE_DOCUMENTS_CTES`, `db/document-visibility.ts`, binds `?1` owner,
     `?2` now): own, joined teams', shared with the reader, live only, with `scope_tab_id` for a tab-scoped link.
   - `hits`: `content_search_fts MATCH ?` (the trigrams quoted and joined with `OR`), joined to `content_search`
     and `visible` (`v.scope_tab_id IS NULL OR v.scope_tab_id = s.tab_id`, and `s.tab_id <> '~items'` when scoped),
     ordered by `bm25(content_search_fts)`, at most `SEARCH_CANDIDATES` rows, with
     `snippet(content_search_fts, 0, char(1), char(2), '…', SNIPPET_TOKENS)`.
   - Keep a hit when, for every long word, at least `SEARCH_MIN_TRIGRAM_SHARE` of its trigrams occur in
     `folded` (`instr`), and every short word starts a word of `' ' || folded`.
   - `matched` = the count of all query trigrams in `folded`.
   - One row per document: `ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY rank, matched DESC)`.
   - Order: `rank`, then `matched DESC`, then `documents.saved_at DESC`; at most `SEARCH_RESULTS_MAX`.
5. Short words only: the same `visible` join over `content_search` with every short word a word start, ordered by
   `saved_at DESC`, at most `SEARCH_RESULTS_MAX`; the snippet is cut from `text` around the first word start
   (`snippetAround`).
6. Each snippet: the sentinels become `marks` (offsets into the text without them), adjacent marks merged, then
   `trimSnippet` cuts to at most `SNIPPET_MAX_CHARS` at word boundaries with `…`.
7. Answer 200 `{ matches: ContentMatch[] }`; `tabId` and `tabName` null for the `~items` row.

### Presentation

Not here: the Ctrl K search's own spec and blueprint read `ContentSearchDTO` and decide how matches show, when the
request fires and what it counts.

## Interfaces and contracts

- `GET /api/search/content?q=` → `ContentSearchDTO = { matches: ContentMatchDTO[] }` in `@livedoc/api-schema`;
  400 `invalid_request` when `q` is missing; 401 without a caller; 429 `rate_limited`; 503 `search_unavailable` when
  the statement fails. Listed in the OpenAPI manifest; read-only tokens may call it.
- D1 migration (with the storage blueprint's):

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

- Budget (`content-search.test.ts`, node:sqlite with FTS5 trigram): 20,000 rows of 8 KB from 1,000 owners, a reader
  with 200 documents, a 3-word query: under 50 ms; a 1-word short query: under 20 ms.
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
| Route: 400, 401, 429, 503                                     | `content-search-route.test.ts`         |
| Budget                                                        | `content-search.test.ts`               |

## Constants and configuration

| Constant                   | Value    | Provenance                                     | Safe range       |
| -------------------------- | -------- | ---------------------------------------------- | ---------------- |
| `SEARCH_TEXT_MAX_CHARS`    | 32,768   | spec                                           | 4,096 to 262,144 |
| `SEARCH_QUERY_MAX_CHARS`   | 512      | the lens's cap                                 | fixed            |
| `SEARCH_TRIGRAMS_MAX`      | 32       | spec                                           | 8 to 64          |
| `SEARCH_MIN_TRIGRAM_SHARE` | 0.5      | spec ("at least half")                         | 0.3 to 0.8       |
| `SEARCH_RESULTS_MAX`       | 50       | spec                                           | 10 to 200        |
| `SEARCH_CANDIDATES`        | 500      | ten times the results, before the share filter | 100 to 2,000     |
| `SNIPPET_TOKENS`           | 160      | trigram tokens are about one character each    | 64 to 256        |
| `SNIPPET_MAX_CHARS`        | 160      | spec ("about 160 characters")                  | 80 to 240        |
| Rate limit                 | 120/60 s | spec                                           | 30 to 600        |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D179 to D184.
