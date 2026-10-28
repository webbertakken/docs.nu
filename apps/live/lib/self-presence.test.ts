// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PARTICIPANT_COLORS } from './identity';
import { announceSelfColour, onSelfColour, presenceColourName } from './self-presence';

// docs/specs/014-identity/auth-and-guest-access.md "Account settings": the Colour row and the profile card.
describe('presenceColourName', () => {
  it('names every presence colour, each once', () => {
    const names = PARTICIPANT_COLORS.map(presenceColourName);
    expect(names).toEqual([
      'Sky',
      'Emerald',
      'Amber',
      'Red',
      'Violet',
      'Pink',
      'Teal',
      'Orange',
      'Indigo',
      'Lime',
    ]);
  });

  it('calls a colour off the palette Custom, whatever its case', () => {
    expect(presenceColourName('#0EA5E9')).toBe('Sky');
    expect(presenceColourName('#123456')).toBe('Custom');
  });
});

describe('the self colour announcement', () => {
  it('reaches every listener with the participant and its colour, until unsubscribed', () => {
    const heard = vi.fn();
    const stop = onSelfColour(heard);
    announceSelfColour('acct_1', '#ef4444');
    expect(heard).toHaveBeenCalledWith({ id: 'acct_1', color: '#ef4444' });
    stop();
    announceSelfColour('acct_1', '#0ea5e9');
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
