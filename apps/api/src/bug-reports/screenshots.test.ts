import { beforeEach, describe, expect, it } from 'vitest';
import { bytesToBase64, type BugReportScreenshot } from '@livedoc/api-schema';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { reporterTag } from './reporter';
import { deleteBugScreenshotsOf, putBugScreenshot, serveBugScreenshot } from './screenshots';
import { testR2, type TestR2 } from './test-r2';

// docs/specs/016-platform/bug-reports.md "Filing" step 4 and "Screenshots".

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const shot = (bytes: Uint8Array, contentType: BugReportScreenshot['contentType']) => ({
  contentType,
  data: bytesToBase64(bytes),
});
const GUEST = { kind: 'guest', id: 'g-1' } as const;
const KEY = /^[0-9a-f]{32}\/[0-9a-f-]{36}\.png$/;

let bucket: TestR2;
let db: SqliteD1;

beforeEach(() => {
  bucket = testR2();
  db = sqliteD1({ BUG_SCREENSHOTS: bucket } as Partial<Env>);
});

describe('putBugScreenshot', () => {
  it('stores the bytes under the reporter tag with their type', async () => {
    const put = await putBugScreenshot(db.env, GUEST, shot(PNG, 'image/png'));
    expect(put.kind).toBe('stored');
    if (put.kind !== 'stored') return;
    expect(put.key).toMatch(KEY);
    expect(put.key.startsWith(`${await reporterTag(GUEST)}/`)).toBe(true);
    const stored = bucket.objects.get(`bug-reports/${put.key}`);
    expect(stored?.contentType).toBe('image/png');
    expect([...(stored?.bytes ?? [])]).toEqual([...PNG]);
  });

  it('refuses bytes that are not the type they claim', async () => {
    expect(await putBugScreenshot(db.env, GUEST, shot(JPEG, 'image/png'))).toEqual({
      kind: 'mismatch',
    });
    expect(bucket.objects.size).toBe(0);
  });

  it('goes without the screenshot when there is no bucket', async () => {
    const env = { ...db.env, BUG_SCREENSHOTS: undefined } as Env;
    expect(await putBugScreenshot(env, GUEST, shot(PNG, 'image/png'))).toEqual({
      kind: 'unstored',
      why: 'no_bucket',
    });
  });

  it('goes without the screenshot when the put fails', async () => {
    bucket.failPuts = true;
    expect(await putBugScreenshot(db.env, GUEST, shot(PNG, 'image/png'))).toEqual({
      kind: 'unstored',
      why: 'put_failed',
    });
  });
});

describe('serveBugScreenshot', () => {
  let key: string;

  beforeEach(async () => {
    db.sql.exec(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('tracker', 'acct_webber', 'Bug Tracker', 0, 1, 1)`,
    );
    const put = await putBugScreenshot(db.env, GUEST, shot(PNG, 'image/png'));
    key = put.kind === 'stored' ? put.key : '';
  });

  const get = (
    path: string,
    opts: { verifiedAccountId?: string; headers?: Record<string, string>; env?: Partial<Env> } = {},
  ) =>
    serveBugScreenshot(
      makeTestRouteContext('GET', `/api/bug-reports/screenshots/${path}`, {
        env: { ...db.env, BUG_REPORT_DOCUMENT_ID: 'tracker', ...opts.env } as Env,
        ...(opts.verifiedAccountId ? { verifiedAccountId: opts.verifiedAccountId } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      }),
    );

  it('serves the Bug Tracker owner the bytes, locked down', async () => {
    const res = await get(key, { verifiedAccountId: 'acct_webber' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...PNG]);
  });

  it.each([
    ['another account', { verifiedAccountId: 'acct_other' }],
    ['the owner id sent as a bare guest header', { headers: { 'X-Owner-Id': 'acct_webber' } }],
    ['no identity', {}],
  ])('answers 404 to %s', async (_label, opts) => {
    expect((await get(key, opts)).status).toBe(404);
  });

  it('answers 404 on a host with no Bug Tracker', async () => {
    const res = await get(key, { verifiedAccountId: 'acct_webber', env: { BUG_REPORT_DOCUMENT_ID: '' } });
    expect(res.status).toBe(404);
  });

  it.each(['../secrets/x.png', 'anonymous/not-a-uuid.png', `${'a'.repeat(32)}/x`])(
    'answers 404 to the malformed key %s',
    async (bad) => {
      expect((await get(bad, { verifiedAccountId: 'acct_webber' })).status).toBe(404);
    },
  );

  it('answers 404 to a key that holds nothing (expired or erased)', async () => {
    const gone = `anonymous/0f8fad5b-d9cb-469f-a165-70867728950e.png`;
    expect((await get(gone, { verifiedAccountId: 'acct_webber' })).status).toBe(404);
  });
});

describe('deleteBugScreenshotsOf', () => {
  it("deletes that reporter's screenshots and no one else's", async () => {
    await putBugScreenshot(db.env, GUEST, shot(PNG, 'image/png'));
    await putBugScreenshot(db.env, { kind: 'guest', id: 'g-2' }, shot(PNG, 'image/png'));
    expect(await deleteBugScreenshotsOf(db.env, 'g-1')).toBe(1);
    const tag = await reporterTag({ kind: 'guest', id: 'g-2' });
    expect([...bucket.objects.keys()].map((k) => k.split('/')[1])).toEqual([tag]);
  });

  it('does nothing without a bucket', async () => {
    expect(await deleteBugScreenshotsOf({ ...db.env, BUG_SCREENSHOTS: undefined } as Env, 'g-1')).toBe(0);
  });
});
