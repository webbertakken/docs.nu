import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWTPayload } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import {
  getAccountSession,
  JWKS_CACHE_MS,
  JWKS_GRACE_S,
  resetSessionKeyCache,
} from './session-token';

const ORIGIN = 'https://docs.test';
const ACCOUNT = 'acct_0123456789abcdefABCDEFgh';
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

type Key = { kid: string; privateKey: CryptoKey };

async function addKey(
  sql: ReturnType<typeof sqliteD1>['sql'],
  kid: string,
  expiresAt: string | null = null,
): Promise<Key> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  sql
    .prepare(
      'INSERT INTO identity_jwks (id, publicKey, privateKey, createdAt, expiresAt, alg, crv) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      kid,
      JSON.stringify(await exportJWK(publicKey)),
      'encrypted',
      new Date(NOW).toISOString(),
      expiresAt,
      'EdDSA',
      'Ed25519',
    );
  return { kid, privateKey };
}

function sign(
  key: Key,
  claims: JWTPayload,
  opts: { iss?: string; exp?: number; sub?: string } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: key.kid })
    .setSubject(opts.sub ?? ACCOUNT)
    .setIssuer(opts.iss ?? ORIGIN)
    .setAudience(ORIGIN)
    .setIssuedAt(NOW / 1000)
    .setExpirationTime(opts.exp ?? NOW / 1000 + 900)
    .sign(key.privateKey);
}

const CLAIMS = { email: 'Ada@Example.com', email_verified: true, auth_time: NOW / 1000 - 30 };

let env: Env;
let sql: ReturnType<typeof sqliteD1>['sql'];

beforeEach(() => {
  ({ env, sql } = sqliteD1({
    BETTER_AUTH_SECRET: 's'.repeat(32),
    APP_BASE_URL: ORIGIN,
    EMAIL_OUTBOX: '1',
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  resetSessionKeyCache();
  vi.restoreAllMocks();
});

describe('getAccountSession', () => {
  it('answers the account, its verified email and when it signed in', async () => {
    const key = await addKey(sql, 'k1');
    expect(await getAccountSession(env, await sign(key, CLAIMS), NOW)).toEqual({
      accountId: ACCOUNT,
      email: 'ada@example.com',
      emailVerified: true,
      authTime: NOW / 1000 - 30,
    });
  });

  it('reads an unverified or missing email and a missing auth time as such', async () => {
    const key = await addKey(sql, 'k1');
    expect(await getAccountSession(env, await sign(key, { email: '' }), NOW)).toEqual({
      accountId: ACCOUNT,
      email: null,
      emailVerified: false,
      authTime: null,
    });
  });

  it('is null when sign-in is off, without reading anything', async () => {
    const key = await addKey(sql, 'k1');
    const token = await sign(key, CLAIMS);
    expect(
      await getAccountSession({ ...env, BETTER_AUTH_SECRET: undefined }, token, NOW),
    ).toBeNull();
  });

  it.each([
    ['expired', { exp: NOW / 1000 - 60 }, 'ERR_JWT_EXPIRED'],
    [
      'another issuer',
      { iss: 'https://feat-x.preview.docs.test' },
      'ERR_JWT_CLAIM_VALIDATION_FAILED',
    ],
  ])('rejects a token that is %s', async (_, opts, reason) => {
    const key = await addKey(sql, 'k1');
    expect(await getAccountSession(env, await sign(key, CLAIMS, opts), NOW)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(`[auth] session_token_rejected reason=${reason}`);
  });

  it('rejects a subject that is not an account id', async () => {
    const key = await addKey(sql, 'k1');
    const token = await sign(key, CLAIMS, { sub: crypto.randomUUID() });
    expect(await getAccountSession(env, token, NOW)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[auth] session_token_rejected reason=not_account_id',
    );
  });

  it('rejects garbage and a key it does not hold', async () => {
    expect(await getAccountSession(env, 'not.a.jwt', NOW)).toBeNull();
    const stranger = {
      kid: 'unknown',
      privateKey: (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey,
    };
    expect(await getAccountSession(env, await sign(stranger, CLAIMS), NOW)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[auth] session_token_rejected reason=unknown');
    expect(console.warn).toHaveBeenCalledWith(
      '[auth] session_token_rejected reason=ERR_JWKS_NO_MATCHING_KEY',
    );
  });

  it('caches the keys, and re-reads them for a key id it has not seen (a rotation)', async () => {
    const first = await addKey(sql, 'k1');
    expect(await getAccountSession(env, await sign(first, CLAIMS), NOW)).not.toBeNull();
    expect(await getAccountSession(env, await sign(first, CLAIMS), NOW + 1000)).not.toBeNull();
    expect(console.info).toHaveBeenCalledTimes(1);
    const second = await addKey(sql, 'k2');
    expect(await getAccountSession(env, await sign(second, CLAIMS), NOW + 2000)).not.toBeNull();
    expect(console.info).toHaveBeenLastCalledWith('[auth] jwks_reloaded reason=kid_miss');
    expect(
      await getAccountSession(env, await sign(second, CLAIMS), NOW + JWKS_CACHE_MS + 3000),
    ).not.toBeNull();
    expect(console.info).toHaveBeenLastCalledWith('[auth] jwks_reloaded reason=ttl');
  });

  it('keeps verifying a rotated-out key through its grace period, then stops', async () => {
    const old = await addKey(sql, 'old', new Date(NOW - 1000).toISOString());
    const token = await sign(old, CLAIMS);
    expect(await getAccountSession(env, token, NOW)).not.toBeNull();
    resetSessionKeyCache();
    const later = NOW + JWKS_GRACE_S * 1000;
    const lateToken = await sign(old, CLAIMS, { exp: later / 1000 + 900 });
    expect(await getAccountSession(env, lateToken, later)).toBeNull();
  });

  it('reads a key row with no algorithm as EdDSA', async () => {
    const key = await addKey(sql, 'k1');
    sql.prepare("UPDATE identity_jwks SET alg = NULL WHERE id = 'k1'").run();
    expect(await getAccountSession(env, await sign(key, CLAIMS), NOW)).not.toBeNull();
  });

  it('skips a key row it cannot parse', async () => {
    sql
      .prepare(
        "INSERT INTO identity_jwks (id, publicKey, privateKey, createdAt, expiresAt, alg, crv) VALUES ('bad', '{', 'x', '2026-01-01', NULL, NULL, NULL), ('num', '1', 'x', '2026-01-01', NULL, NULL, NULL), ('nul', 'null', 'x', '2026-01-01', NULL, NULL, NULL)",
      )
      .run();
    const key = await addKey(sql, 'k1');
    expect(await getAccountSession(env, await sign(key, CLAIMS), NOW)).not.toBeNull();
  });
});
