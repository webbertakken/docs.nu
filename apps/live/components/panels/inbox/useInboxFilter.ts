'use client';

import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { isInboxFilter, type InboxFilter } from './inbox-entries';

// The Inbox's filter choice (docs/specs/013-workspace/inbox.md §1.3): per viewer on this device, beside the
// Explorer's other view choices (`livedoc:explorer-view`, `livedoc:explorer-details-sort`).
export const INBOX_FILTER_KEY = 'livedoc:explorer-inbox-filter';

export function useInboxFilter(viewerId: string): [InboxFilter, (f: InboxFilter) => void] {
  const key = `${INBOX_FILTER_KEY}:${viewerId}`;
  const stored = useLocalStorageValue(key);
  const filter = isInboxFilter(stored) ? stored : 'all';
  return [filter, (f) => writeLocalStorageValue(key, f)];
}
