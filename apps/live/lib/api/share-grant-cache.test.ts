// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readCachedShareGrant, writeCachedShareGrant } from './core';

// The visitor's share grant cache (docs/specs/013-workspace/share-password.md, "Password cache"): one grant per
// share code, never the password, emptied when the server refuses it.

const GRANT_1 = `spg_${'a'.repeat(43)}`;
const GRANT_2 = `spg_${'b'.repeat(43)}`;

beforeEach(() => window.localStorage.clear());

describe('the share grant cache', () => {
  it('keeps one grant per share code', () => {
    writeCachedShareGrant('CODE1', GRANT_1);
    writeCachedShareGrant('CODE2', GRANT_2);
    expect(readCachedShareGrant('CODE1')).toBe(GRANT_1);
    expect(readCachedShareGrant('CODE2')).toBe(GRANT_2);
    expect(window.localStorage.getItem('livedoc:share-grant:CODE1')).toBe(GRANT_1);
  });

  it('reads nothing for a code it has never seen', () => {
    expect(readCachedShareGrant('NEVER')).toBeNull();
  });

  it('removes an entry when cleared or given no grant', () => {
    writeCachedShareGrant('CODE1', GRANT_1);
    writeCachedShareGrant('CODE1', null);
    expect(window.localStorage.getItem('livedoc:share-grant:CODE1')).toBeNull();
    writeCachedShareGrant('CODE1', GRANT_1);
    writeCachedShareGrant('CODE1', '');
    expect(readCachedShareGrant('CODE1')).toBeNull();
  });

  it('never keeps or returns anything that is not a grant, such as a typed password', () => {
    writeCachedShareGrant('CODE1', 'otter');
    expect(window.localStorage.getItem('livedoc:share-grant:CODE1')).toBeNull();
    window.localStorage.setItem('livedoc:share-grant:CODE1', 'otter');
    expect(readCachedShareGrant('CODE1')).toBeNull();
  });

  it('removes a password an earlier version kept in plain text', () => {
    window.localStorage.setItem('livediagram:share-password:CODE1', 'otter');
    expect(readCachedShareGrant('CODE1')).toBeNull();
    expect(window.localStorage.getItem('livediagram:share-password:CODE1')).toBeNull();
  });
});
