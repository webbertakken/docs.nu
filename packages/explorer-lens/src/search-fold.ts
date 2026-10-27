// Content search's folding (docs/specs/013-workspace/content-search.md "Matching"): the same folding and word split
// names get (title-fold.ts, title-match.ts), so a query reads the same against a name and against a document's text.

import { foldText } from './title-fold';
import { compileTitleQuery } from './title-match';

const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Text folded as names are, its words joined by single spaces: what content search compares against. */
export function foldSearchText(text: string): string {
  return foldText(text).replace(NON_WORD, ' ').trim();
}

/** A query's folded words, split wherever a character is neither letter nor digit, as a name query's are. */
export function searchQueryWords(query: string): string[] {
  return compileTitleQuery([query]).words.map((w) => w.text);
}
