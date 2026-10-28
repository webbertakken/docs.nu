import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityLogger } from './identity-logger';

// What better-auth throws when the session-token key was encrypted under a secret no longer in use.
const undecryptable = new Error(
  'Failed to decrypt private key. Make sure the secret currently in use is the same as the one used to encrypt the private key.',
);

beforeEach(() => {
  for (const method of ['error', 'warn', 'info'] as const)
    vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('identityLogger', () => {
  it('names JWT keys the secret cannot decrypt as [auth] jwks_undecryptable', () => {
    identityLogger.log('error', 'BetterAuthError', undecryptable);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[auth] jwks_undecryptable');
  });

  it('passes every other line through at its own level', () => {
    const other = new Error('no such table');
    identityLogger.log('error', 'BetterAuthError', other);
    identityLogger.log('warn', 'rate limit off');
    identityLogger.log('info', 'started');
    identityLogger.log('debug', 'detail');
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[Better Auth] BetterAuthError', other);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('[Better Auth] rate limit off');
    expect(vi.mocked(console.info).mock.calls).toEqual([
      ['[Better Auth] started'],
      ['[Better Auth] detail'],
    ]);
  });
});
