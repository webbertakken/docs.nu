import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import {
  currentSecret,
  identityConfigOf,
  reportIdentityConfig,
  resetIdentityConfigReport,
} from './identity-config';

const SECRET = 's'.repeat(32);
const BASE = { BETTER_AUTH_SECRET: SECRET, APP_BASE_URL: 'https://docs.nu' };
const GOOGLE = {
  GOOGLE_AUTH_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_AUTH_CLIENT_SECRET: 'g',
};
const EMAIL = { EMAIL: { send: async () => ({ messageId: 'm' }) } };
const config = (env: object) => identityConfigOf(env as Env);

afterEach(() => {
  resetIdentityConfigReport();
  vi.restoreAllMocks();
});

describe('identityConfigOf', () => {
  it('is off with no secret, whatever else is set', () => {
    expect(config({ ...GOOGLE, ...EMAIL, APP_BASE_URL: 'https://docs.nu' })).toEqual({
      enabled: false,
      methods: [],
      googleClientId: null,
      origin: null,
      secret: null,
      problem: null,
    });
  });

  it('refuses a secret shorter than 32 characters', () => {
    expect(config({ ...BASE, ...EMAIL, BETTER_AUTH_SECRET: 'short' })).toMatchObject({
      enabled: false,
      problem: 'secret_too_short',
    });
  });

  it('needs the base URL', () => {
    expect(config({ BETTER_AUTH_SECRET: SECRET, ...EMAIL })).toMatchObject({
      enabled: false,
      problem: 'base_url_missing',
    });
  });

  it('offers Google with both Google keys', () => {
    expect(config({ ...BASE, ...GOOGLE, APP_BASE_URL: 'https://docs.nu/path' })).toEqual({
      enabled: true,
      methods: ['google'],
      googleClientId: GOOGLE.GOOGLE_AUTH_CLIENT_ID,
      origin: 'https://docs.nu',
      secret: SECRET,
      problem: null,
    });
  });

  it('offers email codes with an email transport', () => {
    expect(config({ ...BASE, ...EMAIL }).methods).toEqual(['email-code']);
    expect(config({ ...BASE, RESEND_API_KEY: 're_x' }).methods).toEqual(['email-code']);
    expect(config({ ...BASE, EMAIL_OUTBOX: '1' }).methods).toEqual(['email-code']);
  });

  it('offers both, Google first', () => {
    expect(config({ ...BASE, ...GOOGLE, ...EMAIL }).methods).toEqual(['google', 'email-code']);
  });

  it('stays off with a secret but no method', () => {
    expect(config(BASE)).toMatchObject({ enabled: false, problem: 'secret_without_methods' });
  });

  it('names a half-made Google configuration but still offers email codes', () => {
    expect(config({ ...BASE, ...EMAIL, GOOGLE_AUTH_CLIENT_ID: 'id' })).toMatchObject({
      enabled: true,
      methods: ['email-code'],
      googleClientId: null,
      problem: 'google_half_configured',
    });
  });
});

describe('currentSecret', () => {
  it('prefers the newest rotated secret', () => {
    expect(currentSecret({ BETTER_AUTH_SECRETS: '2:new:with:colons,1:old' } as Env)).toBe(
      'new:with:colons',
    );
  });

  it('falls back to BETTER_AUTH_SECRET, trimmed, and to null', () => {
    expect(currentSecret({ BETTER_AUTH_SECRET: ' x ' } as Env)).toBe('x');
    expect(currentSecret({ BETTER_AUTH_SECRET: '  ' } as Env)).toBeNull();
    expect(currentSecret({ BETTER_AUTH_SECRETS: '' } as Env)).toBeNull();
  });
});

describe('reportIdentityConfig', () => {
  it('logs a problem once per isolate and nothing when all is well', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportIdentityConfig(config(BASE));
    reportIdentityConfig(config(BASE));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[auth] secret_without_methods');
    resetIdentityConfigReport();
    reportIdentityConfig(config({ ...BASE, ...EMAIL }));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
