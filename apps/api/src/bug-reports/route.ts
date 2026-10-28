// /api/bug-reports (docs/specs/016-platform/bug-reports.md "Filing", "Screenshots"): POST a report, GET a screenshot.
import { methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from '../routes/context';
import { serveBugScreenshot } from './screenshots';
import { submitBugReport } from './submit';

export async function handleBugReports(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  if (segments.length === 2)
    return request.method === 'POST' ? submitBugReport(ctx) : methodNotAllowed();
  if (segments[2] === 'screenshots')
    return request.method === 'GET' ? serveBugScreenshot(ctx) : methodNotAllowed();
  return notFound();
}
