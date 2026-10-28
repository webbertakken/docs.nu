'use client';

// The Inbox's data (docs/specs/013-workspace/inbox.md §1, §5): one read, split into the
// sections the Inbox lists, plus the count the sidebar badge draws. My Actions holds actions and
// Plan cards (§2.4) in one list. The read is the server's and, beside it, this browser's documents in This Browser
// (§2.6), whose rows are marked `local` so they show the This Browser pill.
//
// Held in Explorer state (like favourites) rather than gated to the
// section, because the sidebar badge renders on every Explorer section
// and reads the same list. The payload is small and capped (docs/specs/013-workspace/inbox.md
// §3), so one read on mount is cheaper than a second endpoint for the
// count, and the badge can never disagree with the page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActivityAction,
  ActivityCard,
  ActivityCardThread,
  ActivityThread,
  ActivityFormResponses,
} from '@livedoc/api-schema';
import { apiListActivity } from '@/lib/api-client';
import { getGuestSelfId } from '@/lib/local-identity';
import { readOfflineActivity, type OfflineActivity } from '@/lib/offline/offline-activity';
import { useReturnToTab } from '@/hooks/ui/useReturnToTab';
import { track } from '@/lib/telemetry';

/** A row, marked `local` when it comes from a document saved only in this browser (§2.6). */
export type Located<T> = T & { local?: true };

/** One My Actions row: an action or a Plan card, told apart by `kind`. */
export type AssignedRow =
  Located<{ kind: 'action' } & ActivityAction> | Located<{ kind: 'card' } & ActivityCard>;

/** One Comments row: an element's thread or a Plan card's (§2.5), told apart by `kind`. */
export type ThreadRow =
  Located<{ kind: 'thread' } & ActivityThread> | Located<{ kind: 'card' } & ActivityCardThread>;

/** Each row's key in the Inbox (docs/specs/013-workspace/inbox.md §1.2): unique per row and stable across reads, so
 *  the choice survives a re-read and a row done here stays gone (`dismiss`). */
export const activityRowKey = {
  action: (a: ActivityAction) => `a:${a.documentId}:${a.tabId}:${a.elementId}:${a.id}`,
  card: (c: ActivityCard) => `c:${c.documentId}:${c.id}`,
  thread: (t: ActivityThread) => `t:${t.documentId}:${t.tabId}:${t.elementId}`,
  cardThread: (t: ActivityCardThread) => `ct:${t.documentId}:${t.id}`,
  form: (f: ActivityFormResponses) => `f:${f.documentId}:${f.tabId}`,
} as const;

const NO_LOCAL: OfflineActivity = { actions: [], threads: [], cards: [], cardThreads: [] };

const markLocal = <T extends object>(rows: T[]): Located<T>[] =>
  rows.map((r) => ({ ...r, local: true as const }));

// This Browser's documents in This Browser (§2.6), read beside the server's index. The store failing lists nothing
// local, never the page's failed state: that is the server read's to report.
function readLocal(owner: string): Promise<OfflineActivity> {
  return readOfflineActivity([owner, getGuestSelfId()]).then(
    (local) => ({
      actions: markLocal(local.actions),
      threads: markLocal(local.threads),
      cards: markLocal(local.cards),
      cardThreads: markLocal(local.cardThreads),
    }),
    (err: unknown) => {
      console.warn('[inbox] offline-read-failed', err);
      return NO_LOCAL;
    },
  );
}

export type ActivityFeed = {
  /** Open actions (self-assignments included) and open Plan cards on the reader, newest first. */
  assignedToMe: AssignedRow[];
  /** Open actions the reader assigned to somebody ELSE. */
  youAssigned: Located<ActivityAction>[];
  /** Unresolved threads the reader is in, on elements and on Plan cards, newest comment first. */
  threads: ThreadRow[];
  /** Forms with responses the reader has not seen (docs/specs/030-forms/forms.md), newest response first. */
  formResponses: ActivityFormResponses[];
  loading: boolean;
  /** The last read FAILED — not the same as nothing outstanding. */
  error: boolean;
  retry: () => void;
  /** A row whose work was done from the Inbox (§1.5), by its `activityRowKey`: gone from every list now, and from
   *  every later read while the feed lives, even one made before the index caught up. */
  dismiss: (key: string) => void;
};

export function useActivityFeed(ownerId: string | null): ActivityFeed {
  const [actions, setActions] = useState<Located<ActivityAction>[]>([]);
  const [threads, setThreads] = useState<Located<ActivityThread>[]>([]);
  const [cards, setCards] = useState<Located<ActivityCard>[]>([]);
  const [cardThreads, setCardThreads] = useState<Located<ActivityCardThread>[]>([]);
  const [formResponses, setFormResponses] = useState<ActivityFormResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // Guards a late response from a previous owner id (a guest signing in
  // mid-session re-runs this with a different id).
  const requestId = useRef(0);

  // One read, settling state only from its response, so the load effect
  // below only starts it.
  const fetchFeed = useCallback((owner: string, mode: 'replace' | 'merge') => {
    const id = (requestId.current += 1);
    return Promise.all([apiListActivity(owner), readLocal(owner)]).then(([result, local]) => {
      if (id !== requestId.current) return;
      if (!result) {
        // A 'merge' (returning to the tab) keeps what it had: a stale
        // list beats an alarm. A 'replace' has nothing to keep.
        setError(true);
        if (mode === 'replace') {
          setActions([]);
          setThreads([]);
          setCards([]);
          setCardThreads([]);
          setFormResponses([]);
        }
        setLoading(false);
        return;
      }
      setError(false);
      setActions([...result.actions, ...local.actions]);
      setThreads([...result.threads, ...local.threads]);
      setCards([...result.cards, ...local.cards]);
      setCardThreads([...(result.cardThreads ?? []), ...local.cardThreads]);
      setFormResponses(result.formResponses ?? []);
      setLoading(false);
    });
  }, []);

  const load = useCallback(
    async (mode: 'replace' | 'merge') => {
      if (!ownerId) return;
      if (mode === 'replace') setLoading(true);
      await fetchFeed(ownerId, mode);
    },
    [ownerId, fetchFeed],
  );

  // A new owner is loading from its first render.
  const [loadingFor, setLoadingFor] = useState(ownerId);
  if (ownerId !== loadingFor) {
    setLoadingFor(ownerId);
    setDismissed(new Set());
    if (ownerId) setLoading(true);
  }

  useEffect(() => {
    if (ownerId) void fetchFeed(ownerId, 'replace');
  }, [ownerId, fetchFeed]);

  // Coming back to a tab that has been open since yesterday re-reads
  // the list; also how a failed first read heals without a click.
  useReturnToTab(() => void load('merge'), { enabled: !!ownerId });

  const retry = useCallback(() => {
    track('Activity', 'Loaded', 'Retry');
    void load('replace');
  }, [load]);

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  const kept = useCallback(
    <T>(rows: T[], keyOf: (row: T) => string) =>
      dismissed.size === 0 ? rows : rows.filter((r) => !dismissed.has(keyOf(r))),
    [dismissed],
  );
  const openActions = useMemo(() => kept(actions, activityRowKey.action), [kept, actions]);

  // The split (docs/specs/013-workspace/inbox.md §1.1): a self-assignment is "My Actions" and
  // only that, so one action never lists twice.
  const assignedToMe = useMemo(
    () =>
      [
        ...openActions
          .filter((a) => a.assignedToMe)
          .map((a) => ({ kind: 'action' as const, ...a })),
        ...kept(cards, activityRowKey.card).map((c) => ({ kind: 'card' as const, ...c })),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    [openActions, cards, kept],
  );
  const youAssigned = useMemo(
    () =>
      openActions
        .filter((a) => a.createdByMe && !a.assignedToMe)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [openActions],
  );

  const threadRows = useMemo(
    () =>
      [
        ...kept(threads, activityRowKey.thread).map((t) => ({ kind: 'thread' as const, ...t })),
        ...kept(cardThreads, activityRowKey.cardThread).map((t) => ({
          kind: 'card' as const,
          ...t,
        })),
      ].sort((a, b) => b.latest.at - a.latest.at),
    [threads, cardThreads, kept],
  );

  const openForms = useMemo(() => kept(formResponses, activityRowKey.form), [kept, formResponses]);

  return {
    assignedToMe,
    youAssigned,
    threads: threadRows,
    formResponses: openForms,
    loading,
    error,
    retry,
    dismiss,
  };
}
