import { describe, expect, it } from 'vitest';
import { signOwnerId } from '../auth/owner-signature';
import { makeTestRouteContext } from '../routes/test-route-context';
import type { Env } from '../types';
import { reporterTag, resolveBugReporter } from './reporter';

// docs/specs/016-platform/bug-reports.md "Filing" step 3: the reporter comes from the request's identity, never its
// body, and a guest id must prove itself where the host signs them.

const GUEST = '0f8fad5b-d9cb-469f-a165-70867728950e';
const signing = { BETTER_AUTH_SECRET: 'a-test-secret-long-enough-to-sign-with-123' } as Env;

const ctx = (opts: Parameters<typeof makeTestRouteContext>[2]) =>
  makeTestRouteContext('POST', '/api/bug-reports', opts);

describe('resolveBugReporter', () => {
  it('names a verified account', async () => {
    expect(await resolveBugReporter(ctx({ verifiedAccountId: 'acct_1' }))).toEqual({
      kind: 'account',
      id: 'acct_1',
    });
  });

  it('names a guest on a host that signs nothing', async () => {
    expect(await resolveBugReporter(ctx({ headers: { 'X-Owner-Id': GUEST } }))).toEqual({
      kind: 'guest',
      id: GUEST,
    });
  });

  it('names a guest whose id is signed where the host signs them', async () => {
    const sig = await signOwnerId(signing, GUEST);
    const reporter = await resolveBugReporter(
      ctx({ env: signing, headers: { 'X-Owner-Id': GUEST, 'X-Owner-Sig': sig! } }),
    );
    expect(reporter).toEqual({ kind: 'guest', id: GUEST });
  });

  it('files an unsigned guest as anonymous where the host signs them', async () => {
    expect(
      await resolveBugReporter(ctx({ env: signing, headers: { 'X-Owner-Id': GUEST } })),
    ).toEqual({ kind: 'anonymous', id: null });
  });

  it('files an account id sent as the guest header as anonymous', async () => {
    expect(
      await resolveBugReporter(ctx({ headers: { 'X-Owner-Id': 'acct_webber' } })),
    ).toEqual({ kind: 'anonymous', id: null });
  });

  it('files a request with no identity as anonymous', async () => {
    expect(await resolveBugReporter(ctx({}))).toEqual({ kind: 'anonymous', id: null });
  });
});

describe('reporterTag', () => {
  it('is 32 hex characters of the id hashed, the same each time', async () => {
    const tag = await reporterTag({ kind: 'guest', id: GUEST });
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
    expect(await reporterTag({ kind: 'account', id: GUEST })).toBe(tag);
    expect(tag).not.toContain(GUEST.slice(0, 8));
  });

  it('is anonymous without an id', async () => {
    expect(await reporterTag({ kind: 'anonymous', id: null })).toBe('anonymous');
  });
});
