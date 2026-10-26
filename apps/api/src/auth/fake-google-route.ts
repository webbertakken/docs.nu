// Test-only: sign-in with Google against the e2e suite's fake Google (docs/specs/003-system-architecture/e2e-smoke.md
// "Signed-in specs"). better-auth names Google's token endpoint outright, with no option to move it, so on a stack that sets
// GOOGLE_OAUTH_BASE_URL (the same variable the Drive mirror's OAuth honours) the worker's fetch sends that one origin
// to the fake instead. Only a loopback http origin is honoured: a real deployment never sets the variable, and one that
// did could not point Google's token exchange anywhere but its own machine.
import type { Env } from '../types';

const GOOGLE_TOKEN_ORIGIN = 'https://oauth2.googleapis.com';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

let fakeOrigin: string | null = null;
let realFetch: typeof fetch | null = null;

// The fake's origin when `base` names one this worker may use: http on loopback.
export function fakeGoogleOriginOf(base: string | undefined): string | null {
  const trimmed = base?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) ? url.origin : null;
}

export function routeGoogleTokenCallsToFake(env: Env): void {
  const origin = fakeGoogleOriginOf(env.GOOGLE_OAUTH_BASE_URL);
  if (!origin) {
    if (env.GOOGLE_OAUTH_BASE_URL?.trim() && fakeOrigin === null) {
      console.error('[identity] GOOGLE_OAUTH_BASE_URL ignored: not an http loopback origin');
    }
    return;
  }
  if (fakeOrigin === origin) return;
  if (fakeOrigin === null) {
    realFetch = globalThis.fetch;
    const real = realFetch.bind(globalThis);
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (fakeOrigin && request.url.startsWith(`${GOOGLE_TOKEN_ORIGIN}/`)) {
        return real(
          new Request(fakeOrigin + request.url.slice(GOOGLE_TOKEN_ORIGIN.length), request),
        );
      }
      return real(request);
    };
  }
  fakeOrigin = origin;
  console.info('[identity] Google token calls go to the fake Google', { origin });
}

// For tests of this module: the worker's own fetch back, nothing routed.
export function stopRoutingGoogleTokenCalls(): void {
  if (realFetch) globalThis.fetch = realFetch;
  realFetch = null;
  fakeOrigin = null;
}
