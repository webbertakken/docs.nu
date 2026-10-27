// Content search's wire shape (docs/specs/013-workspace/content-search.md "What it answers"): per matched document,
// the tab it was found in and a line of its text with the matched stretches as ranges, never markup.

/** A half-open range of UTF-16 offsets into a snippet's text. */
export type ContentSnippetMark = [number, number];

export type ContentMatchDTO = {
  documentId: string;
  /** The tab the text was found in; null when it was the document's cards. */
  tabId: string | null;
  tabName: string | null;
  snippet: { text: string; marks: ContentSnippetMark[] };
};

/** `GET /api/search/content?q=`: best first, one per document, at most 50. */
export type ContentSearchDTO = { matches: ContentMatchDTO[] };
