// @vitest-environment jsdom

import { SIGNED_IN_HINT_KEY } from '@livediagram/account-session';
import { afterEach, describe, expect, it } from 'vitest';
import { readSignedInHint } from './signed-in-hint';

describe('readSignedInHint', () => {
  afterEach(() => localStorage.clear());

  it('reads a browser no session has settled in as a guest', () => {
    expect(readSignedInHint()).toBe(false);
  });

  it('follows the last session the bridge settled', () => {
    localStorage.setItem(SIGNED_IN_HINT_KEY, '1');
    expect(readSignedInHint()).toBe(true);
    localStorage.setItem(SIGNED_IN_HINT_KEY, '0');
    expect(readSignedInHint()).toBe(false);
  });
});
