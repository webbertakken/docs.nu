// How the worker answers a request that threw (docs/specs/015-api/api.md "When a request fails"): D1 failing on its
// side is a retryable 503, anything else a 500. Neither body echoes the error's text, which can name tables.

import { apiRouteLabel, errorTypeToken } from '@livedoc/api-schema';
import { insertTelemetryEvents } from './db/telemetry';
import { json } from './responses';
import type { Env } from './types';

// Seconds a caller waits before retrying a request D1 could not serve; the room's own 503s use the same.
export const STORAGE_RETRY_AFTER_SECONDS = 5;

// D1's own failures (https://developers.cloudflare.com/d1/observability/debug-d1/#error-list): the database, not
// the query, is at fault, so the same call succeeds once it recovers. A constraint, type or SQL error is a bug and
// is never matched here.
const STORAGE_UNAVAILABLE =
  /^D1_ERROR: (?:internal error|network connection lost|d1 db is overloaded|cannot resolve d1 db due to transient issue|d1 db storage operation exceeded timeout|internal error while starting up d1 db storage|d1 db reset because its code was updated)/i;

export function isStorageUnavailable(err: unknown): boolean {
  return err instanceof Error && STORAGE_UNAVAILABLE.test(err.message);
}

export function failedRequestResponse(
  err: unknown,
  request: Request,
  env: Env,
  executionCtx?: ExecutionContext,
): Response {
  const route = apiRouteLabel(request.method, new URL(request.url).pathname);
  if (isStorageUnavailable(err)) {
    console.error(`[d1] unavailable route=${route}`, err);
    return json(
      { error: 'storage_unavailable' },
      { status: 503, headers: { 'Retry-After': String(STORAGE_RETRY_AFTER_SECONDS) } },
    );
  }
  console.error(`api error route=${route}`, err);
  // Self-report the crash to the events table (docs/specs/017-telemetry/telemetry.md 'Error' category): the worker
  // owns the D1 binding, so a server-side exception counts even when no client survives to report it. Off the
  // response's critical path, and its own failure is logged, never thrown: the 500 must still go out.
  if (env.TELEMETRY_ENABLED === 'true') {
    const report = insertTelemetryEvents(
      env,
      [{ category: 'Error', action: 'Api', type: errorTypeToken('Internal', route) }],
      Date.now(),
    ).catch((reportErr: unknown) => console.error('[telemetry] crash report failed', reportErr));
    executionCtx?.waitUntil?.(report);
  }
  return json({ error: 'internal_error' }, { status: 500 });
}
