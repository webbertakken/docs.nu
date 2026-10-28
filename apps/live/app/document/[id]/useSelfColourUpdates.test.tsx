// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Participant } from '@/lib/identity';
import { announceSelfColour } from '@/lib/self-presence';
import { useSelfColourUpdates } from './useSelfColourUpdates';

// docs/specs/014-identity/auth-and-guest-access.md "Account settings": the open editor takes a colour picked in
// Settings at once, without saving it a second time.
const ADA: Participant = { id: 'acct_1', name: 'Ada', color: '#ef4444', status: 'online' };

function useHarness() {
  const [self, setSelf] = useState(ADA);
  const persisted = useRef<{ name: string; color: string } | null>({
    name: 'Ada',
    color: '#ef4444',
  });
  useSelfColourUpdates(setSelf, persisted);
  return { self, persisted };
}

describe('useSelfColourUpdates', () => {
  it('takes a colour announced for this participant, already saved', () => {
    const { result } = renderHook(useHarness);
    act(() => announceSelfColour('acct_1', '#0ea5e9'));
    expect(result.current.self.color).toBe('#0ea5e9');
    expect(result.current.persisted.current).toEqual({ name: 'Ada', color: '#0ea5e9' });
  });

  it('ignores a colour announced for someone else', () => {
    const { result } = renderHook(useHarness);
    act(() => announceSelfColour('guest_9', '#0ea5e9'));
    expect(result.current.self.color).toBe('#ef4444');
    expect(result.current.persisted.current?.color).toBe('#ef4444');
  });
});
