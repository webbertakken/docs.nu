// A document's History (docs/specs/013-workspace/timeline.md §2.10): its pure rules. The day
// headings, the runs of one type by one person that fold into one entry, the kinds a filter chip
// offers, the summary strip and when the document was made. No React here, so each is tested on
// its own; the dialog memoises them once per loaded page and filter.

import { eventCategory, sortCategories, type TimelineCategory } from './eventCategory';
import type { TimelineEvent } from './types';
import { dateKey, formatDay } from './useTimelineGrouping';

const DAY_MS = 24 * 60 * 60 * 1000;

// Within this many days a heading says the weekday; past it, the date.
const WEEKDAY_SPAN_DAYS = 7;

/** "Today", "Yesterday", the weekday within the last week, then "Tue, 5 Aug" (with its year when
 *  not this year's). A forward-dated day (an expiry warning) is dated. */
export function historyDayLabel(key: string, now: number): string {
  if (key === dateKey(now)) return 'Today';
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y!, m! - 1, d);
  if (Number.isNaN(day.getTime())) return key;
  const today = new Date(now);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // Rounded, so a clock change inside the span does not shift a day.
  const ago = Math.round((midnight - day.getTime()) / DAY_MS);
  if (ago === 1) return 'Yesterday';
  if (ago > 1 && ago < WEEKDAY_SPAN_DAYS) {
    return day.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  const { label, year } = formatDay(key);
  return year !== String(today.getFullYear()) ? `${label} ${year}` : label;
}

/** One entry on the rail: an event alone, or a run of one type by one person (newest first). */
export type HistoryRun = { key: string; events: TimelineEvent[] };

export type HistoryDay = { key: string; label: string; runs: HistoryRun[]; count: number };

const sameRun = (a: TimelineEvent, b: TimelineEvent) =>
  a.eventType === b.eventType && (a.actorId ?? '') === (b.actorId ?? '');

/** Newest-first events into local days, each day's consecutive events of one type by one person
 *  folded into a run. One pass, linear in the events. */
export function buildHistory(events: readonly TimelineEvent[], now: number): HistoryDay[] {
  const days: HistoryDay[] = [];
  let day: HistoryDay | null = null;
  let run: HistoryRun | null = null;
  for (const event of events) {
    const key = dateKey(event.occurredAt);
    if (!day || day.key !== key) {
      day = { key, label: historyDayLabel(key, now), runs: [], count: 0 };
      days.push(day);
      run = null;
    }
    if (run && sameRun(run.events[0]!, event)) run.events.push(event);
    else {
      run = { key: event.id, events: [event] };
      day.runs.push(run);
    }
    day.count += 1;
  }
  return days;
}

export type HistoryChip = { category: TimelineCategory; count: number };

/** The kinds the loaded events hold, in the feed's fixed chip order, and how many of each. */
export function historyCategories(events: readonly TimelineEvent[]): HistoryChip[] {
  const counts = new Map<TimelineCategory, number>();
  for (const event of events) {
    const category = eventCategory(event.eventType);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return sortCategories(counts.keys()).map((category) => ({
    category,
    count: counts.get(category)!,
  }));
}

/** One kind of event, or every event when no chip is on. */
export function filterHistory(
  events: readonly TimelineEvent[],
  category: TimelineCategory | null,
): readonly TimelineEvent[] {
  return category ? events.filter((e) => eventCategory(e.eventType) === category) : events;
}

export type HistorySummary = {
  count: number;
  /** The people who took part, newest first: one event each, the one that names them. */
  people: TimelineEvent[];
};

export function summariseHistory(events: readonly TimelineEvent[]): HistorySummary {
  const seen = new Map<string, TimelineEvent>();
  for (const event of events) {
    if (event.actorId && !seen.has(event.actorId)) seen.set(event.actorId, event);
  }
  return { count: events.length, people: [...seen.values()] };
}

/** "3 events"; "50+ events" while older ones remain. */
export function eventCountLabel(count: number, more: boolean): string {
  return `${count}${more ? '+' : ''} ${count === 1 && !more ? 'event' : 'events'}`;
}

/** When the document was made: its own `createdAt`, else a loaded Document Created event, else
 *  unknown (null) rather than guessed. */
export function historyCreatedAt(
  createdAt: number | undefined,
  events: readonly TimelineEvent[],
): number | null {
  if (createdAt !== undefined) return createdAt;
  return events.find((e) => e.eventType === 'document_created')?.occurredAt ?? null;
}
