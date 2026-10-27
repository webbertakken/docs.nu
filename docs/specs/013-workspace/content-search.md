# Content search

The Explorer's free text finds a document by what it holds as well as by its name.
Names match in the browser ([Explorer filters](explorer-filters.md#matching)); content matches in the api Worker,
in a D1 full-text index each document's room keeps current ([Document storage](../006-document/document-storage.md)).
Both forgive a typo and ignore case and accents.

## Words

- **Search text**: the text of one tab as content search sees it, which its room pushes to the index.
- **Content match**: a document found by its search text, with the tab and the stretch that matched.
- **Trigram**: three letters or digits in a row from one word; the index's unit of matching.
- **Short word**: a query word under 3 characters, too short to hold a trigram.

## What is searched

A tab's search text is, in reading order:

- the tab's name;
- every element's texts that the agents' `find` view searches: label, note, table cells, entity fields, checklist
  items, chart nodes, code and comments ([Document views](../024-agents/document-views.md));
- its articles' text, its pages' titles and its form's title, questions and choices;
- on a Sheet tab, the inputs of its sheets' cells.

A document's items (titles and text fields) are one more search text of the document, under no tab.
Each search text is cut at 32,768 characters; what lies past it is not found.
Image pixels, file bytes, links' targets and stroke shapes are not searched.

## Who finds what

- A reader finds only documents they may open, by the same rule as the lists: their own, their joined teams', and
  those shared with them, never one in the Trash.
- A reader whose access to a document is through a tab-scoped link finds only that tab's text.
- Documents in **This Browser** are matched by name only: their content never reaches the api.
- A document a link no longer reaches, or a team the reader has left, drops out at once, as from the lists.

## Matching

- The query is folded as names are: lower case, accents stripped, split into words wherever a character is neither
  letter nor digit ([Explorer filters](explorer-filters.md#matching)).
- **Words of 3 characters or more** match by their trigrams: a tab matches when at least half of the query's trigrams
  appear in its search text, so a typo or two still finds the word.
- **Short words** must start a word of the search text.
- **A query of short words only** matches by those word starts alone.
- Every word of the query must be satisfied in one tab, as every word of a name must be.
- A document matches by its best tab; the search answers at most 50 documents.

## Ranking

- Documents matched by name come first, in the name matcher's order.
- Documents matched by content only follow, best first: by how well the tab's text fits the query (`bm25`), then by
  how many of the query's trigrams it holds, then newest saved first.
- A query of short words only ranks its content matches newest saved first.

## What a row shows

- A document matched by content only shows, under its name, the tab it was found in and a line of its text around
  the match, the matched stretches marked: "In Sprint 12 · …the **retrospective** notes for the kanban…".
- A document matched by name shows as the lens shows it today, with no content line.
- The line is at most about 160 characters, cut at word boundaries with an ellipsis.

## States

| State   | Shows                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Typing  | Name matches at once; content matches join under them when they arrive                                     |
| Loading | Name matches, and a quiet line under them: "Searching inside documents…"                                   |
| Failed  | Name matches, and a quiet line under them: "Couldn’t search inside documents." with **Try again**          |
| None    | No content line when nothing matched by content; the lens's own Filtered empty when nothing matched at all |

- Content search waits until typing pauses for 300 ms, and runs only when the free text holds a letter or digit.
- A newer query cancels an older one; an answer for an old query is never shown.
- The live region counts both kinds together, once the content answer has arrived.

## Freshness

The index trails a write by up to about a minute, the outbox's pace; a document is always found by its name at once.

## Limits and abuse

- A query is at most 512 characters, as the lens is; only its first 32 distinct trigrams are matched.
- Each person may search at most 120 times a minute; past it the api answers 429 and the Explorer keeps the name
  matches.
- The index stores no text the reader could not already read in the document.

## Telemetry

- The lens's `Explorer / Selected / Text` already counts a search ([Explorer filters](explorer-filters.md#telemetry)).
- Opening a document from a content match emits `Explorer / Opened / ContentMatch` once, never the query or an id
  ([Telemetry](../017-telemetry/telemetry.md)); it says whether finding by content is used.

## Not part of it

- The wiki's in-wiki search and `livedoc search` ([Wiki](../032-wikis/wiki.md#search)) may read the same index later;
  their result shapes are theirs.
- Search inside one open document stays the editor's own Find.
