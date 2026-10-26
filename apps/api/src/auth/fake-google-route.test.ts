import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import {
  fakeGoogleOriginOf,
  routeGoogleTokenCallsToFake,
  stopRoutingGoogleTokenCalls,
} from './fake-google-route';

const envWith = (base?: string) => ({ GOOGLE_OAUTH_BASE_URL: base }) as Env;

afterEach(() => {
  stopRoutingGoogleTokenCalls();
  vi.restoreAllMocks();
});

describe('fakeGoogleOriginOf', () => {
  it('honours only an http origin on loopback', () => {
    expect(fakeGoogleOriginOf('http://127.0.0.1:8797')).toBe('http://127.0.0.1:8797');
    expect(fakeGoogleOriginOf(' http://localhost:8797/ ')).toBe('http://localhost:8797');
    expect(fakeGoogleOriginOf('https://127.0.0.1:8797')).toBeNull();
    expect(fakeGoogleOriginOf('http://evil.example')).toBeNull();
    expect(fakeGoogleOriginOf('not a url')).toBeNull();
    expect(fakeGoogleOriginOf('')).toBeNull();
    expect(fakeGoogleOriginOf(undefined)).toBeNull();
  });
});

describe('routeGoogleTokenCallsToFake', () => {
  it('sends Google token calls to the fake and everything else where it was going', async () => {
    const seen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      seen.push(new Request(input).url);
      return new Response('{}');
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    routeGoogleTokenCallsToFake(envWith('http://127.0.0.1:8797'));
    await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: 'code=x' });
    await fetch('https://www.googleapis.com/drive/v3/about');
    expect(seen).toEqual([
      'http://127.0.0.1:8797/token',
      'https://www.googleapis.com/drive/v3/about',
    ]);
  });

  it('leaves fetch alone, and says so, for an origin it will not honour', () => {
    const before = globalThis.fetch;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    routeGoogleTokenCallsToFake(envWith('https://accounts.example'));
    routeGoogleTokenCallsToFake(envWith(undefined));
    expect(globalThis.fetch).toBe(before);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
