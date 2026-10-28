'use client';

// The last blank (docs/specs/013-workspace/new-document-menu.md "The button"): the blank this browser made last from
// the New Document menu, which the split button's face makes and the menu opens on. Diagram before any. An external
// store over localStorage (useLocalStorageValue), so the static page hydrates on Diagram and every reader follows.
import { newDocumentBlankOf, type NewDocumentBlankId } from '@livedoc/templates';
import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { debugLog } from '@/lib/debug-log';

const KEY = 'livedoc:v2:last-new-document-blank';

export const FIRST_BLANK: NewDocumentBlankId = 'diagram';

export function lastBlankOf(stored: string | null): NewDocumentBlankId {
  if (stored === null) return FIRST_BLANK;
  const blank = newDocumentBlankOf(stored);
  if (!blank) debugLog('[new-document] last-blank-unknown');
  return blank?.id ?? FIRST_BLANK;
}

export function useLastBlank(): NewDocumentBlankId {
  return lastBlankOf(useLocalStorageValue(KEY));
}

export function writeLastBlank(id: NewDocumentBlankId): void {
  writeLocalStorageValue(KEY, id);
}
