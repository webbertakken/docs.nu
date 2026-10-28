import type { Metadata } from 'next';
import { BugScreenshotPage } from '@/components/bug-report/BugScreenshotPage';

// /report-a-bug/screenshot?key=<key> (docs/specs/016-platform/bug-reports.md "Screenshots"): a filed card's
// screenshot, fetched with the viewer's identity, so only the Bug Tracker's owner sees it.
export const metadata: Metadata = {
  title: 'Bug Report Screenshot | LiveDoc',
};

export default function Page() {
  return <BugScreenshotPage />;
}
