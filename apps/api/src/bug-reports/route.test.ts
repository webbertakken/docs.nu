import { beforeEach, describe, expect, it } from 'vitest';
import { BUG_REPORT_LIMITS, bytesToBase64 } from '@livedoc/api-schema';
import { listItems } from '../db';
import { BUG_REPORT_WINDOW_MAX } from '../db/bug-reports';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { handleBugReports } from './route';
import { seedBugTracker } from './test-bug-tracker';
import { testR2, type TestR2 } from './test-r2';

// docs/specs/016-platform/bug-reports.md "Filing": POST /api/bug-reports, every outcome in the spec's table.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);
const GUEST = '0f8fad5b-d9cb-469f-a165-70867728950e';

let db: SqliteD1;
let bucket: TestR2;

beforeEach(() => {
  db = sqliteD1();
  seedBugTracker(db);
  bucket = testR2();
  Object.assign(db.env, {
    BUG_SCREENSHOTS: bucket,
    BUG_REPORT_DOCUMENT_ID: 'tracker',
    BUG_REPORT_TAB_ID: 'board',
    APP_BASE_URL: 'https://docs.nu',
  } satisfies Partial<Env>);
});

async function post(
  body: unknown,
  opts: {
    headers?: Record<string, string>;
    rawBody?: string;
    method?: string;
    path?: string;
    verifiedAccountId?: string;
  } = {},
) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'POST', opts.path ?? '/api/bug-reports', {
    env: db.env,
    owner: null,
    ...(opts.rawBody !== undefined
      ? { rawBody: opts.rawBody }
      : body === undefined
        ? {}
        : { body }),
    headers: { 'CF-Connecting-IP': '203.0.113.9', 'X-Owner-Id': GUEST, ...opts.headers },
    ...(opts.verifiedAccountId ? { verifiedAccountId: opts.verifiedAccountId } : {}),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleBugReports(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

const storedRows = () =>
  db.sql
    .prepare('SELECT owner_id, reporter_kind, title, reason, screenshot_url FROM bug_reports')
    .all();

describe('POST /api/bug-reports', () => {
  it('files a card and answers its number', async () => {
    expect(await post({ title: 'Save fails' })).toMatchObject({ status: 201, body: { number: 1 } });
    const [card] = await listItems(db.env, 'tracker');
    expect(card?.fields).toMatchObject({
      title: 'Save fails',
      status: 'reported',
      'f-rep': `Guest \`${GUEST}\``,
    });
  });

  it('names the account, never a reporter the body claims', async () => {
    await post(
      { title: 'x', reporter: { kind: 'account', id: 'acct_other' } },
      { verifiedAccountId: 'acct_ann' },
    );
    expect((await listItems(db.env, 'tracker'))[0]?.fields['f-rep']).toBe('Account `acct_ann`');
  });

  it('stores the screenshot and links its page from the card', async () => {
    const res = await post({
      title: 'x',
      screenshot: { contentType: 'image/png', data: bytesToBase64(PNG) },
    });
    expect(res.status).toBe(201);
    const [key] = [...bucket.objects.keys()];
    const link = (await listItems(db.env, 'tracker'))[0]?.fields['f-shot'];
    expect(link).toBe(
      `https://docs.nu/report-a-bug/screenshot?key=${encodeURIComponent(key!.replace('bug-reports/', ''))}`,
    );
  });

  it('refuses a screenshot whose bytes are not its type', async () => {
    const res = await post({
      title: 'x',
      screenshot: { contentType: 'image/webp', data: bytesToBase64(PNG) },
    });
    expect(res).toMatchObject({
      status: 400,
      body: { error: 'invalid_bug_report', problem: 'screenshot_invalid' },
    });
    expect(bucket.objects.size).toBe(0);
  });

  it('files without the screenshot when the bucket fails', async () => {
    bucket.failPuts = true;
    const res = await post({
      title: 'x',
      screenshot: { contentType: 'image/png', data: bytesToBase64(PNG) },
    });
    expect(res.status).toBe(201);
    expect((await listItems(db.env, 'tracker'))[0]?.fields['f-shot']).toBeUndefined();
  });

  it('stores the report when the board is not configured, and says so', async () => {
    Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: undefined });
    expect(await post({ title: 'Save fails' })).toMatchObject({
      status: 202,
      body: { stored: true },
    });
    expect(storedRows()).toEqual([
      {
        owner_id: GUEST,
        reporter_kind: 'guest',
        title: 'Save fails',
        reason: 'unconfigured',
        screenshot_url: null,
      },
    ]);
  });

  it('answers 503 when the board refuses and the store fails too', async () => {
    Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: undefined });
    db.sql.exec('DROP TABLE bug_reports');
    expect(await post({ title: 'x' })).toMatchObject({
      status: 503,
      body: { error: 'bug_reports_unavailable' },
    });
  });

  it.each([
    ['malformed JSON', { rawBody: '{nope' }, 'not_an_object'],
    ['a blank title', { body: { title: ' ' } }, 'title_missing'],
  ])('refuses %s with 400', async (_label, input, problem) => {
    const res = await post(
      'body' in input ? input.body : null,
      'rawBody' in input ? { rawBody: input.rawBody } : {},
    );
    expect(res).toMatchObject({ status: 400, body: { error: 'invalid_bug_report', problem } });
  });

  it('refuses a body over the limit with 413', async () => {
    const res = await post(null, {
      rawBody: JSON.stringify({ title: 'x', details: 'y'.repeat(BUG_REPORT_LIMITS.bodyBytes) }),
    });
    expect(res).toMatchObject({ status: 413, body: { error: 'payload_too_large' } });
  });

  it('refuses any method but POST, and any other path', async () => {
    expect((await post(undefined, { method: 'GET' })).status).toBe(405);
    expect((await post(null, { path: '/api/bug-reports/other' })).status).toBe(404);
  });

  it('limits a visitor to five reports in the window', async () => {
    for (let i = 0; i < BUG_REPORT_WINDOW_MAX; i++)
      expect((await post({ title: `r${i}` })).status).toBe(201);
    const res = await post({ title: 'one too many' });
    expect(res).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(500);
    expect(
      (
        await post(
          { title: 'someone else' },
          { headers: { 'X-Owner-Id': 'b7c9e1d2-0000-4000-8000-000000000000' } },
        )
      ).status,
    ).toBe(201);
  });

  it('limits bursts per network through the binding', async () => {
    Object.assign(db.env, {
      BUG_REPORT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    } satisfies Partial<Env>);
    const res = await post({ title: 'x' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('lets a report through when the window cannot be counted', async () => {
    db.sql.exec('DROP TABLE bug_report_windows');
    expect((await post({ title: 'x' })).status).toBe(201);
  });

  it('files with no screenshot bucket and no limiter binding at all (self-hosting)', async () => {
    Object.assign(db.env, { BUG_SCREENSHOTS: undefined, BUG_REPORT_RATE_LIMITER: undefined });
    const res = await post({
      title: 'x',
      screenshot: { contentType: 'image/png', data: bytesToBase64(PNG) },
    });
    expect(res.status).toBe(201);
  });
});
