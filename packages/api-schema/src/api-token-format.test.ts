import { describe, expect, it } from 'vitest';
import { API_TOKEN_PREFIX, isApiTokenFormat } from './api-token-format';

// docs/specs/015-api/public-api-and-tokens.md §3.1 "Token format".
describe('isApiTokenFormat', () => {
  it('names the product in its prefix', () => {
    expect(API_TOKEN_PREFIX).toBe('livedoc_');
  });

  it('tells a livedoc_ token from a JWT and from a short string', () => {
    expect(isApiTokenFormat(`livedoc_${'a'.repeat(43)}`)).toBe(true);
    expect(isApiTokenFormat('eyJhbGciOi.payload.sig')).toBe(false);
    expect(isApiTokenFormat('livedoc_short')).toBe(false);
  });

  it('refuses a token minted before the prefix, lvd_', () => {
    expect(isApiTokenFormat(`lvd_${'a'.repeat(43)}`)).toBe(false);
  });
});
