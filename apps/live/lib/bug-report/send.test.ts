import { describe, expect, it, vi } from 'vitest';
import { sendBugReport } from './send';

// docs/specs/016-platform/bug-reports.md "Filing" and "The form" (after sending, on failure).

const submission = { title: 'Save fails' };
const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('sendBugReport', () => {
  it('posts the report with the identity headers', async () => {
    const fetcher = respond(201, { number: 12 });
    const out = await sendBugReport(submission, {
      fetcher,
      identity: async () => ({ Authorization: 'Bearer t' }),
    });
    expect(out).toEqual({ kind: 'filed', number: 12 });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/bug-reports');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer t' });
    expect(JSON.parse(init.body as string)).toEqual(submission);
  });

  it('says a stored report as stored', async () => {
    expect(
      await sendBugReport(submission, {
        fetcher: respond(202, { stored: true }),
        identity: async () => ({}),
      }),
    ).toEqual({
      kind: 'stored',
    });
  });

  it('sends without identity when none can be had', async () => {
    const fetcher = respond(202, { stored: true });
    await sendBugReport(submission, {
      fetcher,
      identity: () => Promise.reject(new Error('no session token')),
    });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it.each([
    [429, 'rate_limited'],
    [413, 'too_large'],
    [400, 'failed'],
    [503, 'failed'],
  ] as const)('says a %i as %s', async (status, reason) => {
    expect(
      await sendBugReport(submission, {
        fetcher: respond(status, { error: 'x' }),
        identity: async () => ({}),
      }),
    ).toEqual({
      kind: 'failed',
      reason,
    });
  });

  it('says a network failure as failed', async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await sendBugReport(submission, { fetcher, identity: async () => ({}) })).toEqual({
      kind: 'failed',
      reason: 'failed',
    });
  });
});
