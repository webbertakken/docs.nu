import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_COPY, authErrorCopy, googleReturnError } from './auth-errors';

describe('authErrorCopy', () => {
  it('names each failure in one sentence of our own', () => {
    expect(authErrorCopy({ code: 'EMAIL_SEND_FAILED', status: 502 })).toBe(
      "We couldn't send the code. Try again in a minute.",
    );
    expect(authErrorCopy({ code: 'TOO_MANY_ATTEMPTS', status: 403 })).toBe(
      'That code has been used up. Send a new one.',
    );
    expect(authErrorCopy({ code: 'INVALID_OTP', status: 400 })).toBe(AUTH_ERROR_COPY.INVALID_OTP);
    expect(authErrorCopy({ code: 'INVALID_ORIGIN', status: 403 })).toBe(
      AUTH_ERROR_COPY.INVALID_ORIGIN,
    );
  });

  it('reads a rate limit by status when the code is missing', () => {
    expect(authErrorCopy({ status: 429 })).toBe(AUTH_ERROR_COPY.RATE_LIMITED);
  });

  it('reads a failed fetch as the network', () => {
    expect(authErrorCopy(new TypeError('Failed to fetch'))).toBe(AUTH_ERROR_COPY.network);
  });

  it('never shows the server wording for an unknown failure', () => {
    expect(authErrorCopy({ code: 'SOMETHING_NEW', message: 'stack trace' })).toBe(
      AUTH_ERROR_COPY.unknown,
    );
    expect(authErrorCopy(null)).toBe(AUTH_ERROR_COPY.unknown);
    expect(authErrorCopy({ code: 42 })).toBe(AUTH_ERROR_COPY.unknown);
  });
});

describe('googleReturnError', () => {
  it('says nothing when there was no error, or the person cancelled at Google', () => {
    expect(googleReturnError(null)).toBeNull();
    expect(googleReturnError('access_denied')).toBeNull();
  });

  it('names a failed round trip', () => {
    expect(googleReturnError('account_not_linked')).toBe(AUTH_ERROR_COPY.account_not_linked);
    expect(googleReturnError('state_mismatch')).toBe(AUTH_ERROR_COPY.unknown);
  });
});
