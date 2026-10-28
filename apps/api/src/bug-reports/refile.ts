// The scheduled refile (docs/specs/016-platform/bug-reports.md "Filing"): every 15 minutes, the oldest stored reports
// are filed again once the Bug Tracker is configured; a filed row goes, a refused one keeps its row with the new reason.
import { deleteBugReport, listDueBugReports, noteBugReportAttempt } from '../db/bug-reports';
import type { Env } from '../types';
import { fileBugReport } from './file';

export const BUG_REPORT_REFILE_EVERY_MINUTES = 15;
export const BUG_REPORT_REFILE_BATCH = 20;

// Whether the every-minute cron's run at `scheduledTime` refiles.
export function isBugReportRefileMinute(scheduledTime: number): boolean {
  return new Date(scheduledTime).getUTCMinutes() % BUG_REPORT_REFILE_EVERY_MINUTES === 0;
}

export async function runBugReportRefile(
  env: Env,
  now: number,
): Promise<{ due: number; filed: number; stored: number }> {
  if (!env.BUG_REPORT_DOCUMENT_ID || !env.BUG_REPORT_TAB_ID) return { due: 0, filed: 0, stored: 0 };
  const due = await listDueBugReports(env, BUG_REPORT_REFILE_BATCH);
  let filed = 0;
  for (const report of due) {
    const outcome = await fileBugReport(env, report.filing);
    if (outcome.filed) {
      await deleteBugReport(env, report.id);
      filed += 1;
      console.info('[bug-reports] report.filed', { number: outcome.number, refiled: true });
    } else {
      await noteBugReportAttempt(env, report.id, outcome.reason, now);
    }
  }
  const result = { due: due.length, filed, stored: due.length - filed };
  console.info('[bug-reports] refile.run', result);
  return result;
}
