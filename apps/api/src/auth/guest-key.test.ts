import { describe, expect, it } from 'vitest';
import { bytesToBase64Url } from '@livediagram/api-schema';
import type { Env } from '../types';
import { guestKeySecret, guestSigningKey } from './guest-key';

const OLD = 'o'.repeat(40);
const NEW = 'n'.repeat(40);
const enc = new TextEncoder();
const env = (vars: Partial<Env>) => vars as Env;

// The key the spec names, derived here independently: HKDF(SHA-256, secret, salt 'livedoc', info
// 'livedoc-guest-id') into 32 bytes of HMAC-SHA-256 key.
async function expectedSignature(secret: string, message: string): Promise<string> {
  const ikm = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('livedoc'),
      info: enc.encode('livedoc-guest-id'),
    },
    ikm,
    256,
  );
  const hmac = await crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', hmac, enc.encode(message)));
}

async function signWith(key: CryptoKey, message: string): Promise<string> {
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

describe('guestKeySecret', () => {
  it('is null on a host with no sign-in secret', () => {
    expect(guestKeySecret(env({}))).toBeNull();
    expect(guestKeySecret(env({ BETTER_AUTH_SECRET: '   ' }))).toBeNull();
  });

  it('is null for a secret too short for sign-in to accept', () => {
    expect(guestKeySecret(env({ BETTER_AUTH_SECRET: 'short' }))).toBeNull();
  });

  it('is BETTER_AUTH_SECRET, trimmed', () => {
    expect(guestKeySecret(env({ BETTER_AUTH_SECRET: ` ${OLD} ` }))).toBe(OLD);
  });

  it('stays on BETTER_AUTH_SECRET through a rotation, which keeps it as the legacy secret', () => {
    expect(
      guestKeySecret(env({ BETTER_AUTH_SECRET: OLD, BETTER_AUTH_SECRETS: `2:${NEW},1:${OLD}` })),
    ).toBe(OLD);
  });

  it('takes the oldest version of BETTER_AUTH_SECRETS when that is all there is', () => {
    expect(guestKeySecret(env({ BETTER_AUTH_SECRETS: `2:${NEW}, 1:${OLD}` }))).toBe(OLD);
    expect(guestKeySecret(env({ BETTER_AUTH_SECRETS: `3:${NEW}` }))).toBe(NEW);
  });

  it('passes over an unusable entry to the next oldest usable one', () => {
    expect(
      guestKeySecret(
        env({ BETTER_AUTH_SECRET: 'short', BETTER_AUTH_SECRETS: `3:${NEW},1:short,x:${OLD}` }),
      ),
    ).toBe(NEW);
  });

  it('keeps a colon inside a versioned secret', () => {
    const withColon = `a:${'b'.repeat(40)}`;
    expect(guestKeySecret(env({ BETTER_AUTH_SECRETS: `1:${withColon}` }))).toBe(withColon);
  });
});

describe('guestSigningKey', () => {
  it('is null with no usable secret', async () => {
    expect(await guestSigningKey(env({}))).toBeNull();
  });

  it('derives the HMAC key from the secret with HKDF, salt livedoc, info livedoc-guest-id', async () => {
    const key = await guestSigningKey(env({ BETTER_AUTH_SECRET: OLD }));
    expect(key).not.toBeNull();
    expect(await signWith(key!, 'guest-1')).toBe(await expectedSignature(OLD, 'guest-1'));
  });

  it('never signs with the secret itself', async () => {
    const key = await guestSigningKey(env({ BETTER_AUTH_SECRET: OLD }));
    const raw = await crypto.subtle.importKey(
      'raw',
      enc.encode(OLD),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    expect(await signWith(key!, 'guest-1')).not.toBe(await signWith(raw, 'guest-1'));
  });

  it('derives once per secret, and again when the secret changes', async () => {
    const first = await guestSigningKey(env({ BETTER_AUTH_SECRET: OLD }));
    expect(await guestSigningKey(env({ BETTER_AUTH_SECRET: OLD }))).toBe(first);
    const other = await guestSigningKey(env({ BETTER_AUTH_SECRET: NEW }));
    expect(other).not.toBe(first);
    expect(await signWith(other!, 'guest-1')).toBe(await expectedSignature(NEW, 'guest-1'));
  });
});
