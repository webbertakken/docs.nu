'use client';

// The standalone Report a Bug page (docs/specs/016-platform/bug-reports.md "Entries"): the form opens at once over a
// plain page; closing it goes back where the reporter came from (`?from=`, a page on this origin), else home.
import { useEffect, useRef } from 'react';
import { Brand, Button } from '@livedoc/ui';
import { BUG_REPORT_COPY as COPY } from './bug-report-copy';
import { useOpenBugReport } from './BugReportProvider';

// Only a path on this origin, never another site.
export function backTarget(search: string): string {
  const from = new URLSearchParams(search).get('from');
  return from && /^\/(?!\/)[^\s\\]*$/.test(from) ? from : '/';
}

export function ReportABugPage() {
  const open = useOpenBugReport();
  const reopenRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open({
      trigger: reopenRef.current,
      onClosed: () => window.location.assign(backTarget(window.location.search)),
    });
  }, [open]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Brand href="/" size="lg" />
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{COPY.name}</h1>
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{COPY.entryDescription}</p>
      <Button
        ref={reopenRef}
        variant="secondary"
        aria-haspopup="dialog"
        onClick={(e) =>
          open({
            trigger: e.currentTarget,
            onClosed: () => window.location.assign(backTarget(window.location.search)),
          })
        }
      >
        {COPY.name}
      </Button>
    </main>
  );
}
