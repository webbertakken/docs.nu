// The profile picture's resolution and the initials fallback (docs/specs/014-identity/profile-picture.md).

import { describe, expect, it } from 'vitest';
import { accountInitial, resolveProfilePicture } from './account-avatar';

const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocL1x2y3=s96-c';

describe('resolveProfilePicture', () => {
  it('draws the Google picture', () => {
    expect(resolveProfilePicture({ image: GOOGLE })).toBe(GOOGLE);
  });

  it('draws the initials for no picture, or one from anywhere else', () => {
    expect(resolveProfilePicture({ image: null })).toBeNull();
    expect(resolveProfilePicture({ image: 'http://lh3.googleusercontent.com/a/x' })).toBeNull();
    expect(resolveProfilePicture({ image: 'https://evil.example/a.png' })).toBeNull();
  });
});

describe('accountInitial', () => {
  it('takes the name, else the email, else a question mark', () => {
    expect(accountInitial({ name: 'ada Lovelace', email: 'x@example.com' })).toBe('A');
    expect(accountInitial({ name: '  ', email: 'grace@example.com' })).toBe('G');
    expect(accountInitial({ name: null, email: null })).toBe('?');
    expect(accountInitial(null)).toBe('?');
  });
});
