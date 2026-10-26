import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      'Chrome on Linux',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0',
      'Edge on Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      'Safari on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile Safari/604.1',
      'Chrome on iOS',
    ],
    ['Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0', 'Firefox on Android'],
    [
      'Mozilla/5.0 (X11; CrOS x86_64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 OPR/120.0',
      'Opera on ChromeOS',
    ],
  ])('names %s', (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected);
  });

  it('names what it can, and says when it cannot', () => {
    expect(describeUserAgent('curl/8.0')).toBe('Unknown browser');
    expect(describeUserAgent('Something (Windows NT 10.0)')).toBe('Windows');
    expect(describeUserAgent('Firefox/144.0')).toBe('Firefox');
    expect(describeUserAgent(null)).toBe('Unknown browser');
    expect(describeUserAgent('')).toBe('Unknown browser');
  });
});
