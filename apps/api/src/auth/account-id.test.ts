import { isAccountIdShape } from '@livediagram/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_ID_RANDOM_LENGTH, generateAccountId } from './account-id';

afterEach(() => vi.restoreAllMocks());

describe('generateAccountId', () => {
  it('is acct_ and 24 base62 characters, an account shape and never a UUID', () => {
    const id = generateAccountId();
    expect(id).toMatch(new RegExp(`^acct_[0-9A-Za-z]{${ACCOUNT_ID_RANDOM_LENGTH}}$`));
    expect(isAccountIdShape(id)).toBe(true);
  });

  it('is different every time', () => {
    const ids = new Set(Array.from({ length: 200 }, generateAccountId));
    expect(ids.size).toBe(200);
  });

  it('draws again for a byte that would bias the alphabet', () => {
    let call = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      // First draw: all biased bytes (skipped); then zeros, which read as '0'.
      (array as Uint8Array).fill(call++ === 0 ? 250 : 0);
      return array;
    });
    expect(generateAccountId()).toBe(`acct_${'0'.repeat(ACCOUNT_ID_RANDOM_LENGTH)}`);
    expect(call).toBe(2);
  });
});
