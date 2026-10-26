// The profile picture URL contract (docs/specs/014-identity/profile-picture.md §2, §6): what the
// api and the room accept, and what the editor draws.

import { describe, expect, it } from 'vitest';
import { isProfilePictureUrl, MAX_PICTURE_URL_LEN, PROFILE_PICTURE_HOST } from './profile-picture';

describe('isProfilePictureUrl', () => {
  it("accepts an https URL on Google's picture host", () => {
    expect(PROFILE_PICTURE_HOST).toBe('lh3.googleusercontent.com');
    expect(
      isProfilePictureUrl('https://lh3.googleusercontent.com/a/ACg8ocJ1x2y3z4AbCdEf=s96-c'),
    ).toBe(true);
  });

  it('rejects other hosts, other schemes, look-alike hosts and non-strings', () => {
    for (const bad of [
      'http://lh3.googleusercontent.com/x',
      'https://evil.example/x',
      'https://lh3.googleusercontent.com.evil.example/x',
      'https://user@evil.example/lh3.googleusercontent.com',
      'javascript:alert(1)',
      '',
      null,
      undefined,
      42,
      { url: 'https://lh3.googleusercontent.com/x' },
    ]) {
      expect(isProfilePictureUrl(bad)).toBe(false);
    }
  });

  it('rejects a URL over the length cap', () => {
    const long = `https://lh3.googleusercontent.com/${'a'.repeat(MAX_PICTURE_URL_LEN)}`;
    expect(isProfilePictureUrl(long)).toBe(false);
    expect(isProfilePictureUrl(long.slice(0, MAX_PICTURE_URL_LEN))).toBe(true);
  });

  it('rejects credentials and non-default ports', () => {
    expect(isProfilePictureUrl('https://a:b@lh3.googleusercontent.com/x')).toBe(false);
    expect(isProfilePictureUrl('https://lh3.googleusercontent.com:8443/x')).toBe(false);
  });
});
