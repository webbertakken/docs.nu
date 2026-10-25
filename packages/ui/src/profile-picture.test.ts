import { describe, expect, it } from 'vitest';
import { pictureHost, pictureSrc, pictureSrcSet } from './profile-picture';

// A Google picture as better-auth stores it at sign-in (`user.image`), sized 96px square.
const BASE = 'https://lh3.googleusercontent.com/a/ACg8ocL1x2y3';
const GOOGLE = `${BASE}=s96-c`;

// The transform (docs/specs/014-identity/profile-picture.md): Google's square size option, nothing else.
describe('pictureSrc', () => {
  it('asks Google for a square size', () => {
    expect(pictureSrc(GOOGLE, 96)).toBe(`${BASE}=s96-c`);
    expect(pictureSrc(GOOGLE, 192)).toBe(`${BASE}=s192-c`);
  });

  it('replaces whatever options the URL had, and adds them where it had none', () => {
    expect(pictureSrc(`${BASE}=w400-h300-p-k-no`, 96)).toBe(`${BASE}=s96-c`);
    expect(pictureSrc(BASE, 96)).toBe(`${BASE}=s96-c`);
  });

  it('offers a 1x and a 2x source for the browser to choose from', () => {
    expect(pictureSrcSet(GOOGLE)).toBe(`${BASE}=s96-c 96w, ${BASE}=s192-c 192w`);
  });
});

describe('pictureHost', () => {
  it('names the host only, never the path', () => {
    expect(pictureHost(`${GOOGLE}?x=1`)).toBe('lh3.googleusercontent.com');
    expect(pictureHost('nonsense')).toBe('invalid');
  });
});
