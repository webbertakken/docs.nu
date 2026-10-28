// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handStartGroup, takeStartGroup } from './start-group';

describe('start group handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('hands a group to the next start once', () => {
    handStartGroup('articles');
    expect(takeStartGroup()).toBe('articles');
    expect(takeStartGroup()).toBeNull();
  });

  it('clears a handed group when handed none', () => {
    handStartGroup('slides');
    handStartGroup(null);
    expect(takeStartGroup()).toBeNull();
  });

  it('reads no group when session storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(takeStartGroup()).toBeNull();
  });
});
