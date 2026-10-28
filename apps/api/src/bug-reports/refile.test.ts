import { beforeEach, describe, expect, it } from 'vitest';
import type { BugReportFiling } from '@livedoc/api-schema';
import { listItems } from '../db';
import { listDueBugReports, storeBugReport } from '../db/bug-reports';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { BUG_REPORT_REFILE_BATCH, isBugReportRefileMinute, runBugReportRefile } from './refile';
import { seedBugTracker } from './test-bug-tracker';

// docs/specs/016-platform/bug-reports.md "Filing": the scheduled refile of stored reports.

let db: SqliteD1;
const filing = (title: string): BugReportFiling => ({
  title,
  reporter: { kind: 'anonymous', id: null },
});
const store = (title: string, at: number) =>
  storeBugReport(
    db.env,
    { filing: filing(title), screenshotKey: null, reason: 'unconfigured' },
    at,
  );

beforeEach(() => {
  db = sqliteD1();
  seedBugTracker(db);
});

describe('runBugReportRefile', () => {
  it('files stored reports oldest first and deletes their rows', async () => {
    await store('second', 2);
    await store('first', 1);
    Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: 'tracker', BUG_REPORT_TAB_ID: 'board' });
    expect(await runBugReportRefile(db.env, 100)).toEqual({ due: 2, filed: 2, stored: 0 });
    const cards = await listItems(db.env, 'tracker');
    expect(cards.map((c) => [c.key, c.fields['title']])).toEqual([
      [1, 'first'],
      [2, 'second'],
    ]);
    expect(await listDueBugReports(db.env, 10)).toEqual([]);
  });

  it('keeps a report the board still refuses, with the new reason and an attempt', async () => {
    await store('x', 1);
    Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: 'tracker', BUG_REPORT_TAB_ID: 'notes' });
    expect(await runBugReportRefile(db.env, 100)).toEqual({ due: 1, filed: 0, stored: 1 });
    expect((await listDueBugReports(db.env, 10))[0]).toMatchObject({
      reason: 'board_missing',
      attempts: 1,
    });
  });

  it('does nothing, not even a read, while the board is unconfigured', async () => {
    await store('x', 1);
    db.sql.exec('DROP TABLE bug_reports');
    expect(await runBugReportRefile(db.env, 100)).toEqual({ due: 0, filed: 0, stored: 0 });
  });

  it('files at most a batch a run', async () => {
    for (let i = 0; i < BUG_REPORT_REFILE_BATCH + 2; i++) await store(`r${i}`, i);
    Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: 'tracker', BUG_REPORT_TAB_ID: 'board' });
    expect((await runBugReportRefile(db.env, 100)).filed).toBe(BUG_REPORT_REFILE_BATCH);
    expect(await listDueBugReports(db.env, 50)).toHaveLength(2);
  });
});

describe('isBugReportRefileMinute', () => {
  it('is every fifteenth minute', () => {
    const at = (minute: number) => Date.UTC(2026, 9, 28, 10, minute);
    expect([0, 15, 30, 45].map((m) => isBugReportRefileMinute(at(m)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([1, 14, 59].map((m) => isBugReportRefileMinute(at(m)))).toEqual([false, false, false]);
  });
});
