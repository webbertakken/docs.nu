import { describe, expect, it, vi } from 'vitest';
import { leaveReportPage } from './ReportABugPage';

// docs/specs/016-platform/bug-reports.md "Entries": closing the form's own page goes back where the reporter came
// from, else home; `?from=` never decides where the browser goes.
const view = (length: number) => ({
  history: { length, back: vi.fn() } as unknown as History,
  location: { assign: vi.fn() } as unknown as Location,
});

describe('leaveReportPage', () => {
  it('goes back to the page the reporter came from', () => {
    const v = view(3);
    leaveReportPage(v);
    expect(v.history.back).toHaveBeenCalledOnce();
    expect(v.location.assign).not.toHaveBeenCalled();
  });

  it('goes home when the form page was opened directly', () => {
    const v = view(1);
    leaveReportPage(v);
    expect(v.location.assign).toHaveBeenCalledWith('/');
  });
});
