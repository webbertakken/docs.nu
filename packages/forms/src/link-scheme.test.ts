import { describe, expect, it } from 'vitest';
import { hasUrlScheme, withUrlScheme } from './link-scheme';

describe('withUrlScheme', () => {
  it('keeps a scheme the text names', () => {
    expect(withUrlScheme('http://example.com')).toBe('http://example.com');
    expect(withUrlScheme('mailto:a@b.co')).toBe('mailto:a@b.co');
    expect(withUrlScheme('javascript:alert(1)')).toBe('javascript:alert(1)');
  });

  it('puts https:// before a bare host', () => {
    expect(withUrlScheme('example.com/x')).toBe('https://example.com/x');
  });

  it('reads a host with a port as a bare host, not a scheme', () => {
    expect(hasUrlScheme('example.com:8080/x')).toBe(false);
    expect(withUrlScheme('localhost:3000')).toBe('https://localhost:3000');
    expect(withUrlScheme('example.com:8080?q=1')).toBe('https://example.com:8080?q=1');
    expect(withUrlScheme('example.com:8080#top')).toBe('https://example.com:8080#top');
  });

  it('still reads a scheme whose text goes on after digits', () => {
    expect(hasUrlScheme('tel:0123x')).toBe(true);
  });
});
