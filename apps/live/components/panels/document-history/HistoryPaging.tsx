'use client';

// Under History's rail (docs/specs/013-workspace/timeline.md §2.10): Show older events while the
// read has a cursor, saying how many are shown; Try again after a later page failed, keeping what
// is shown; and, at the end of a history longer than one page, that this is where it begins.

import { HISTORY_BUTTON, MUTED } from './history-styles';

export function HistoryPaging({
  shown,
  hasMore,
  loadingMore,
  failed,
  longerThanAPage,
  onLoadMore,
}: {
  shown: number;
  hasMore: boolean;
  loadingMore: boolean;
  failed: boolean;
  longerThanAPage: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) {
    return longerThanAPage ? (
      <p className={`px-5 pt-2 pb-6 text-center text-[11px] ${MUTED}`}>
        The beginning of its history
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-col items-center gap-2 px-5 pt-2 pb-6">
      {failed ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          Couldn’t load older events.
        </p>
      ) : null}
      <button
        type="button"
        disabled={loadingMore}
        aria-busy={loadingMore || undefined}
        onClick={onLoadMore}
        className={HISTORY_BUTTON}
      >
        {loadingMore ? 'Loading…' : failed ? 'Try again' : 'Show older events'}
      </button>
      <p className={`text-[11px] ${MUTED}`} aria-live="polite">
        {shown} shown
      </p>
    </div>
  );
}
