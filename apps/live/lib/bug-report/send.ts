// Sending a bug report (docs/specs/016-platform/bug-reports.md "Filing"): the report with the browser's identity, as
// every api call carries it, else without one, since a report never waits on sign-in. Every answer comes back as a
// value the form can say.
import type { BugReportFiledResponse, BugReportSubmission } from '@livedoc/api-schema';
import { API_BASE } from '@/lib/api/base';

export type BugReportSendResult =
  | { kind: 'filed'; number: number }
  | { kind: 'stored' }
  | { kind: 'failed'; reason: 'rate_limited' | 'too_large' | 'failed' };

type Deps = {
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  // The request's identity headers (a session token, else the guest id); a throw sends the report without one.
  identity: () => Promise<Record<string, string>>;
};

async function identityOrNone(identity: Deps['identity']): Promise<Record<string, string>> {
  try {
    return Object.fromEntries(Object.entries(await identity()).filter(([, v]) => v !== ''));
  } catch (error) {
    console.warn('[bug-reports] send.anonymous', { error: String(error) });
    return {};
  }
}

export async function sendBugReport(
  submission: BugReportSubmission,
  { fetcher, identity }: Deps,
): Promise<BugReportSendResult> {
  const headers = { 'Content-Type': 'application/json', ...(await identityOrNone(identity)) };
  let res: Response;
  try {
    res = await fetcher(`${API_BASE}/bug-reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submission),
    });
  } catch (error) {
    console.warn('[bug-reports] send.failed', { status: 0, error: String(error) });
    return { kind: 'failed', reason: 'failed' };
  }
  if (res.status === 201) {
    const { number } = (await res.json()) as BugReportFiledResponse;
    console.info('[bug-reports] sent', { number });
    return { kind: 'filed', number };
  }
  if (res.status === 202) {
    console.info('[bug-reports] sent', { stored: true });
    return { kind: 'stored' };
  }
  console.warn('[bug-reports] send.failed', { status: res.status });
  if (res.status === 429) return { kind: 'failed', reason: 'rate_limited' };
  if (res.status === 413) return { kind: 'failed', reason: 'too_large' };
  return { kind: 'failed', reason: 'failed' };
}
