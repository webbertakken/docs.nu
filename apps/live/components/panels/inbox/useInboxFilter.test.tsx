// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { INBOX_FILTER_KEY, useInboxFilter } from './useInboxFilter';

// The filter bar's choice (docs/specs/013-workspace/inbox.md §1.3): kept per viewer on this device, beside the
// Explorer's other view choices; anything unreadable reads as All.

afterEach(() => localStorage.clear());

describe('useInboxFilter', () => {
  it('starts on All and keeps a choice per viewer', () => {
    const { result } = renderHook(() => useInboxFilter('me'));
    expect(result.current[0]).toBe('all');
    act(() => result.current[1]('comments'));
    expect(result.current[0]).toBe('comments');
    expect(localStorage.getItem(`${INBOX_FILTER_KEY}:me`)).toBe('comments');
    expect(renderHook(() => useInboxFilter('someone-else')).result.current[0]).toBe('all');
  });

  it('reads an unreadable value as All', () => {
    localStorage.setItem(`${INBOX_FILTER_KEY}:fresh`, 'everything');
    expect(renderHook(() => useInboxFilter('fresh')).result.current[0]).toBe('all');
  });
});
