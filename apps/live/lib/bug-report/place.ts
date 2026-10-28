// Where in the editor a bug report was sent from (docs/specs/016-platform/bug-reports.md "Context"): the editor mode,
// the open tab's kind and the share role, published by the editor while it is mounted. A module store rather than a
// context, so the one form at the root reads it without the editor's providers around it.
import { useEffect } from 'react';
import type { BugReportContext } from '@livedoc/api-schema';

export type BugReportPlace = Pick<BugReportContext, 'mode' | 'tabKind' | 'shareRole'>;

let current: BugReportPlace = {};

export function currentBugReportPlace(): BugReportPlace {
  return current;
}

export function setBugReportPlace(place: BugReportPlace): void {
  current = place;
}

// Publishes `place` while the caller is mounted; the newest caller wins, and unmounting clears it.
export function useBugReportPlace({ mode, tabKind, shareRole }: BugReportPlace): void {
  useEffect(() => {
    setBugReportPlace({
      ...(mode ? { mode } : {}),
      ...(tabKind ? { tabKind } : {}),
      ...(shareRole ? { shareRole } : {}),
    });
    return () => setBugReportPlace({});
  }, [mode, tabKind, shareRole]);
}
