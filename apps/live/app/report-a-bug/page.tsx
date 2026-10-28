import type { Metadata } from 'next';
import { ReportABugPage } from '@/components/bug-report/ReportABugPage';

// /report-a-bug[?from=<path>] (docs/specs/016-platform/bug-reports.md "Entries"): the form on its own, for the other
// sites (help centre, marketing, telemetry) and the root error page, which carry no form of their own.
export const metadata: Metadata = {
  title: 'Report a Bug | LiveDoc',
};

export default function Page() {
  return <ReportABugPage />;
}
