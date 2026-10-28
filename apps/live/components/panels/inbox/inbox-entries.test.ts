import { describe, expect, it } from 'vitest';
import {
  bucketEdges,
  bucketOf,
  entryFacts,
  entryHref,
  filterEntries,
  inboxEntries,
  inboxFilterCounts,
  isInboxFilter,
  type InboxEntry,
} from './inbox-entries';
import { action, card, cardThread, feedOf, form, thread } from './inbox-test-utils';

// The Inbox's model (docs/specs/013-workspace/inbox.md §1.1 to §1.3): one list newest first, the filters and their
// counts, the date dividers, and what each row says.

const feed = feedOf({
  assignedToMe: [
    { kind: 'action', ...action() },
    { kind: 'card', ...card() },
  ],
  youAssigned: [
    action({
      id: 'a2',
      assignedToMe: false,
      createdByMe: true,
      assignee: { userId: 'u-sam', name: 'Sam Okafor' },
      updatedAt: 500,
    }),
  ],
  threads: [
    { kind: 'thread', ...thread() },
    { kind: 'card', ...cardThread() },
  ],
  formResponses: [form()],
});

const byKind = (entries: InboxEntry[], kind: InboxEntry['kind'], forMe?: boolean) =>
  entries.find((e) => e.kind === kind && (forMe === undefined || e.forMe === forMe))!;

describe('inboxEntries', () => {
  it('lays every row out newest first, each with a stable unique key', () => {
    const entries = inboxEntries(feed);
    expect(entries.map((e) => [e.kind, e.at])).toEqual([
      ['FormResponses', 5_000],
      ['Thread', 4_000],
      ['Action', 3_000],
      ['Card', 2_000],
      ['CardThread', 1_000],
      ['Action', 500],
    ]);
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    expect(inboxEntries(feed).map((e) => e.key)).toEqual(entries.map((e) => e.key));
  });
});

describe('the filters', () => {
  const entries = inboxEntries(feed);

  it('counts every filter in one pass', () => {
    expect(inboxFilterCounts(entries)).toEqual({
      all: 6,
      mine: 2,
      waiting: 1,
      comments: 2,
      forms: 1,
    });
  });

  it('keeps only the rows a filter holds', () => {
    expect(filterEntries(entries, 'mine').map((e) => e.kind)).toEqual(['Action', 'Card']);
    expect(filterEntries(entries, 'waiting').map((e) => e.at)).toEqual([500]);
    expect(filterEntries(entries, 'comments').map((e) => e.kind)).toEqual(['Thread', 'CardThread']);
    expect(filterEntries(entries, 'forms').map((e) => e.kind)).toEqual(['FormResponses']);
    expect(filterEntries(entries, 'all')).toBe(entries);
  });

  it('reads only its five ids as a filter', () => {
    expect(['all', 'mine', 'waiting', 'comments', 'forms'].every(isInboxFilter)).toBe(true);
    expect(isInboxFilter('Mine')).toBe(false);
    expect(isInboxFilter(null)).toBe(false);
  });
});

describe('the date dividers', () => {
  it('splits today, the six days before, and older', () => {
    const now = new Date(2026, 9, 28, 15, 0).getTime();
    const edges = bucketEdges(now);
    expect(bucketOf(new Date(2026, 9, 28, 0, 0).getTime(), edges)).toBe('today');
    expect(bucketOf(new Date(2026, 9, 27, 23, 59).getTime(), edges)).toBe('week');
    expect(bucketOf(new Date(2026, 9, 22, 0, 0).getTime(), edges)).toBe('week');
    expect(bucketOf(new Date(2026, 9, 21, 23, 59).getTime(), edges)).toBe('older');
  });
});

describe('entryFacts', () => {
  const entries = inboxEntries(feed);

  it('says who assigned my action, and that it is mine to do', () => {
    expect(entryFacts(byKind(entries, 'Action', true))).toMatchObject({
      who: 'Bo Larsen',
      needsYou: true,
      title: 'Write the runbook',
      reason: { kind: 'assigned', label: 'To Do' },
      byline: 'Bo Larsen assigned this to you',
      where: ['Flow', 'Checkout'],
      document: { name: 'Payments', via: 'own' },
      local: false,
    });
  });

  it('reads a self-assignment as mine', () => {
    const [e] = inboxEntries(
      feedOf({ assignedToMe: [{ kind: 'action', ...action({ createdByMe: true }) }] }),
    );
    expect(entryFacts(e!)).toMatchObject({
      who: 'You',
      byline: 'You assigned this to yourself',
    });
  });

  it('says who an action I handed out waits on', () => {
    expect(entryFacts(byKind(entries, 'Action', false))).toMatchObject({
      who: 'Sam Okafor',
      needsYou: false,
      reason: { kind: 'waiting', label: 'Waiting on Sam' },
      byline: 'Waiting on Sam Okafor',
    });
  });

  it('names a Plan card by its number and title, on its board', () => {
    expect(entryFacts(byKind(entries, 'Card'))).toMatchObject({
      who: 'Plan card',
      person: null,
      title: '#12 Wire the form',
      where: ['Plan', 'Sprint 14'],
      byline: 'Assigned to you',
    });
    const [loose] = inboxEntries(
      feedOf({ assignedToMe: [{ kind: 'card', ...card({ board: null }) }] }),
    );
    expect(entryFacts(loose!).where).toEqual(['Not on a board']);
  });

  it('gives a thread its reason: a mention first, then my document, then my comment', () => {
    const facts = (over: Parameters<typeof thread>[0]) =>
      entryFacts(inboxEntries(feedOf({ threads: [{ kind: 'thread', ...thread(over) }] }))[0]!);
    expect(facts({ mentionsYou: true, youCommented: true })).toMatchObject({
      reason: { kind: 'mention', label: 'Mentioned You' },
      byline: 'Priya Shah mentioned you',
      needsYou: true,
    });
    expect(facts({})).toMatchObject({
      reason: { kind: 'yours', label: 'On Your Document' },
      byline: 'Priya Shah commented on your document',
      title: 'Gateway',
      where: ['Flow'],
    });
    expect(facts({ onYourDocument: true, youCommented: true })).toMatchObject({
      reason: { kind: 'commented', label: 'You Commented' },
      byline: 'Priya Shah wrote last',
      needsYou: false,
    });
  });

  it('counts a form’s new responses', () => {
    expect(entryFacts(byKind(entries, 'FormResponses'))).toMatchObject({
      who: 'Form Responses',
      title: 'Bug Report',
      reason: { kind: 'responses', label: '3 New Responses' },
      byline: '3 new responses',
    });
  });

  it('marks a row in This Browser', () => {
    const [e] = inboxEntries(feedOf({ threads: [{ kind: 'thread', ...thread(), local: true }] }));
    expect(entryFacts(e!).local).toBe(true);
  });
});

describe('entryHref', () => {
  it('opens each kind where it lives', () => {
    const entries = inboxEntries(feed);
    expect(entryHref(byKind(entries, 'Action', true))).toBe(
      '/document/d1#t=t1&el=e-a1&open=action',
    );
    expect(entryHref(byKind(entries, 'Thread'))).toBe('/document/d1#t=t1&el=e9&open=comments');
    expect(entryHref(byKind(entries, 'Card'))).toBe('/document/d2#t=tp&el=b1&item=it1');
    expect(entryHref(byKind(entries, 'FormResponses'))).toContain('/document/d3');
  });
});
