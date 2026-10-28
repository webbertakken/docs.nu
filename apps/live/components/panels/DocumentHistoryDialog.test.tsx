// @vitest-environment jsdom

// A document's History (docs/specs/013-workspace/timeline.md §2.10): whose history it is, the
// summary strip, the filter chips, the rail of days with folded runs, paging, and the loading,
// empty and failed states. One paged read, the feed's own.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@livedoc/ui';
import type { PaneDocument } from '@/app/explorer/views';

const { apiListTimeline, track } = vi.hoisted(() => ({
  apiListTimeline: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({
  apiListTimeline,
  apiDismissTimelineEvent: vi.fn(),
  apiDismissTimelineEvents: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: ({ documentId }: { documentId: string }) => (
    <span data-thumbnail={documentId} />
  ),
}));

import { DocumentHistoryDialog } from './DocumentHistoryDialog';

const ME = 'me';
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

function event(id: string, over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id,
    sourceType: 'document',
    sourceId: 'd1',
    eventType: 'document_edited',
    title: 'Document Edited',
    description: 'Payments',
    occurredAt: NOW,
    actorId: ME,
    snapshot: { documentId: 'd1', documentName: 'Payments' },
    ...over,
  };
}

const ROW: PaneDocument = {
  id: 'd1',
  name: 'Payments',
  folderId: null,
  savedAt: NOW - 2 * HOUR,
  shareCode: null,
  ownerId: ME,
  createdAt: new Date(2026, 0, 5, 12).getTime(),
};

function page(events: TimelineEvent[], nextCursor?: string) {
  return { events, nextCursor, lastSeenAt: undefined };
}

function open(document: PaneDocument | undefined = ROW) {
  render(
    <DocumentHistoryDialog
      open
      onClose={() => {}}
      ownerId={ME}
      documentId="d1"
      documentName="Payments"
      document={document}
    />,
  );
  return screen.getByRole('dialog');
}

const entries = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll('[data-history-entry]'));

beforeEach(() => {
  apiListTimeline.mockReset();
  track.mockReset();
});
afterEach(cleanup);

describe('DocumentHistoryDialog', () => {
  it('shows whose history it is: thumbnail, name and owner', async () => {
    apiListTimeline.mockResolvedValue(page([event('a')]));
    const dialog = open();
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Payments' })).toBeTruthy();
    expect(dialog.querySelector('[data-thumbnail="d1"]')).toBeTruthy();
    expect(within(dialog).getByText('Owner:', { exact: false }).parentElement?.textContent).toBe(
      'Owner: You',
    );
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
  });

  it('reads the document’s own scope, once, with the feed’s page size', async () => {
    apiListTimeline.mockResolvedValue(page([event('a')]));
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(apiListTimeline).toHaveBeenCalledTimes(1);
    expect(apiListTimeline.mock.calls[0]![1]).toMatchObject({
      scope: { scopeType: 'document', scopeId: 'd1' },
    });
  });

  it('sums it up: created, last changed, people and events', async () => {
    apiListTimeline.mockResolvedValue(
      page(
        [
          event('a'),
          event('b', {
            eventType: 'comment_added',
            // A document feed hides every id but the reader's.
            actorId: null,
            snapshot: { authorName: 'Ada Lovelace' },
          }),
        ],
        'cursor',
      ),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    const summary = dialog.querySelector('[data-history-summary]') as HTMLElement;
    expect(within(summary).getByText('5 Jan 2026')).toBeTruthy();
    expect(within(summary).getByText('2 hours ago')).toBeTruthy();
    expect(within(summary).getByText('2+')).toBeTruthy();
    expect(within(summary).getByText('2+ events')).toBeTruthy();
    for (const time of summary.querySelectorAll('time')) {
      expect(time.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('leaves Created out when nothing says when it was made', async () => {
    apiListTimeline.mockResolvedValue(page([event('a')]));
    const dialog = open({ ...ROW, createdAt: undefined });
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(within(dialog).queryByText('Created')).toBeNull();
  });

  it('is an ordered list of days, each an ordered list, with machine-readable times', async () => {
    apiListTimeline.mockResolvedValue(
      page([event('a'), event('b', { eventType: 'comment_added', occurredAt: NOW - 30 * HOUR })]),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    const list = within(dialog).getByRole('list', { name: 'Events, newest first' });
    expect(list.tagName).toBe('OL');
    const days = within(list).getAllByRole('heading', { level: 3 });
    expect(days[0]!.textContent).toMatch(/^Today/);
    expect(days[0]!.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const entry of entries(dialog)) {
      expect(entry.closest('ol')).toBeTruthy();
      expect(entry.querySelector('time[datetime]')).toBeTruthy();
    }
  });

  it('says the reason, who did it, the detail and a comment’s words', async () => {
    apiListTimeline.mockResolvedValue(
      page([
        event('a', {
          eventType: 'comment_added',
          title: 'Comment Added',
          description: 'Ship it?',
          actorId: null,
          snapshot: { documentId: 'd1', authorName: 'Ada Lovelace' },
        }),
        event('b', {
          eventType: 'document_moved',
          title: 'Document Moved',
          occurredAt: NOW - HOUR,
          snapshot: { documentId: 'd1', destination: 'Launches' },
        }),
      ]),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    const [comment, moved] = entries(dialog) as HTMLElement[];
    expect(within(comment!).getByText('Comment Added')).toBeTruthy();
    expect(within(comment!).getByText('Ada Lovelace')).toBeTruthy();
    expect(within(comment!).getByText('Ship it?').tagName).toBe('BLOCKQUOTE');
    expect(within(moved!).getByText('Document Moved')).toBeTruthy();
    expect(within(moved!).getByText('You')).toBeTruthy();
    expect(within(moved!).getByText('To Launches', { exact: false })).toBeTruthy();
  });

  it('folds a run of one type by one person, and deals it out on request', async () => {
    apiListTimeline.mockResolvedValue(
      page([
        event('a'),
        event('b', { occurredAt: NOW - 1000 }),
        event('c', { occurredAt: NOW - 2000 }),
        event('d', { eventType: 'comment_added', occurredAt: NOW - 3000 }),
      ]),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    expect(within(dialog).getByText('3 times')).toBeTruthy();
    const toggle = within(dialog).getByRole('button', { name: 'Show all 3' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const run = within(dialog).getByRole('list', { name: 'Document Edited, 3 times' });
    expect(within(run).getAllByRole('listitem')).toHaveLength(3);
    expect(track).toHaveBeenCalledWith('Timeline', 'Opened', 'Run');
  });

  it('keeps apart comments by people the feed names only in words', async () => {
    const by = (id: string, name: string, at: number) =>
      event(id, {
        eventType: 'comment_added',
        title: 'Comment Added',
        actorId: null,
        occurredAt: at,
        snapshot: { documentId: 'd1', authorName: name },
      });
    apiListTimeline.mockResolvedValue(
      page([by('a', 'Ada Lovelace', NOW), by('b', 'Grace Hopper', NOW - 1000)]),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    const summary = dialog.querySelector('[data-history-summary]') as HTMLElement;
    expect(within(summary).getByText('2')).toBeTruthy();
  });

  it('filters by kind with toggle chips', async () => {
    apiListTimeline.mockResolvedValue(
      page([
        event('a'),
        event('b', { eventType: 'share_link_created', occurredAt: NOW - 1000 }),
        event('c', { occurredAt: NOW - 2000, actorId: null }),
      ]),
    );
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(3));
    const chips = within(dialog).getByRole('group', { name: 'Filter by kind' });
    const all = within(chips).getByRole('button', { name: /^All/ });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    const sharing = within(chips).getByRole('button', { name: /^Sharing/ });
    fireEvent.click(sharing);
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(sharing.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(track).toHaveBeenCalledWith('Timeline', 'Selected', 'sharing');
    fireEvent.click(sharing);
    await waitFor(() => expect(entries(dialog)).toHaveLength(3));
  });

  it('leaves the chips off when only one kind is loaded', async () => {
    apiListTimeline.mockResolvedValue(page([event('a')]));
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(within(dialog).queryByRole('group', { name: 'Filter by kind' })).toBeNull();
  });

  it('pages with Show older events, and says when a later page failed', async () => {
    apiListTimeline.mockResolvedValueOnce(page([event('a')], 'c1'));
    const dialog = open();
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(within(dialog).getByText('1 shown')).toBeTruthy();
    expect(within(dialog).queryByText('The beginning of its history')).toBeNull();

    apiListTimeline.mockResolvedValueOnce(null);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show older events' }));
    expect(await within(dialog).findByText('Couldn’t load older events.')).toBeTruthy();
    expect(entries(dialog)).toHaveLength(1);

    // A full older page, so the history now runs past one page and its end says so.
    const older = Array.from({ length: 50 }, (_, i) =>
      event(`old-${i}`, { eventType: 'comment_added', occurredAt: NOW - 30 * HOUR - i * 1000 }),
    );
    apiListTimeline.mockResolvedValueOnce(page(older));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(within(dialog).getByText('51 events')).toBeTruthy());
    expect(within(dialog).queryByText('Couldn’t load older events.')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Show older events' })).toBeNull();
    expect(within(dialog).getByText('The beginning of its history')).toBeTruthy();
  });

  it('shows a busy skeleton while the first page loads', async () => {
    let resolve!: (value: unknown) => void;
    apiListTimeline.mockReturnValue(new Promise((r) => (resolve = r)));
    const dialog = open();
    expect(within(dialog).getByLabelText('Loading history').getAttribute('aria-busy')).toBe('true');
    await act(async () => resolve(page([event('a')])));
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
  });

  it('says when nothing has happened, with no summary', async () => {
    apiListTimeline.mockResolvedValue(page([]));
    const dialog = open();
    expect(await within(dialog).findByText('Nothing has happened yet')).toBeTruthy();
    expect(dialog.querySelector('[data-history-summary]')).toBeNull();
  });

  it('says a failed read failed, never "nothing has happened", and tries again', async () => {
    apiListTimeline.mockResolvedValueOnce(null);
    const dialog = open();
    expect(await within(dialog).findByText('Couldn’t load its history')).toBeTruthy();
    expect(within(dialog).queryByText('Nothing has happened yet')).toBeNull();
    apiListTimeline.mockResolvedValueOnce(page([event('a')]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
  });
});
