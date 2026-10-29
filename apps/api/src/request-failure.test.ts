import { describe, it, expect, vi, beforeEach } from 'vitest';

// The token lookup is the first D1 read a CLI request makes, and it runs before any route: a D1 outage there must
// still be answered by the worker (docs/specs/015-api/api.md "When a request fails").
vi.mock('./auth/session-token', () => ({ getAccountSession: async () => null }));
const { resolveApiTokenMock, listDocumentsMock, insertTelemetryEventsMock } = vi.hoisted(() => ({
  resolveApiTokenMock: vi.fn(),
  listDocumentsMock: vi.fn(),
  insertTelemetryEventsMock: vi.fn(),
}));
vi.mock('./db/telemetry', async (original) => ({
  ...(await original<typeof import('./db/telemetry')>()),
  insertTelemetryEvents: insertTelemetryEventsMock,
}));
vi.mock('./db', async (original) => ({
  ...(await original<typeof import('./db')>()),
  resolveApiToken: resolveApiTokenMock,
  listDocumentsByOwner: listDocumentsMock,
}));

import worker from './index';
import { isStorageUnavailable } from './request-failure';
import type { Env } from './types';

const TOKEN = `livedoc_${'a'.repeat(40)}`;
const D1_INTERNAL = new Error('D1_ERROR: internal error; reference = 5jadrun66l32vrvmnfk8kgts');

const env = (): Env => ({ BETTER_AUTH_SECRET: 's'.repeat(40) }) as unknown as Env;
const listDocuments = () =>
  worker.fetch(
    new Request('https://api.test/api/documents', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }),
    env(),
  );

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resolveApiTokenMock.mockReset();
  listDocumentsMock.mockReset();
  insertTelemetryEventsMock.mockReset();
});

describe('isStorageUnavailable', () => {
  it.each([
    'D1_ERROR: internal error; reference = abc',
    'D1_ERROR: Network connection lost.',
    'D1_ERROR: D1 DB is overloaded. Requests queued for too long.',
    'D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.',
    'D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset.',
    'D1_ERROR: Cannot resolve D1 DB due to transient issue on remote node.',
    'D1_ERROR: D1 DB reset because its code was updated.',
  ])('recognises %s', (message) => {
    expect(isStorageUnavailable(new Error(message))).toBe(true);
  });

  it.each([
    'D1_ERROR: UNIQUE constraint failed: documents.id: SQLITE_CONSTRAINT',
    'D1_TYPE_ERROR: Type undefined not supported for value undefined',
    'D1_ERROR: no such table: documents: SQLITE_ERROR',
    'internal error',
  ])('leaves %s to the 500', (message) => {
    expect(isStorageUnavailable(new Error(message))).toBe(false);
  });

  it('leaves a thrown non-error to the 500', () => {
    expect(isStorageUnavailable('D1_ERROR: internal error')).toBe(false);
  });
});

describe('worker when D1 is unavailable', () => {
  it('answers 503 storage_unavailable when the token lookup throws', async () => {
    resolveApiTokenMock.mockRejectedValue(D1_INTERNAL);

    const res = await listDocuments();

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toContainEqual(['[d1] unavailable route=Get.Documents', D1_INTERNAL]);
  });

  it('answers 503 storage_unavailable when a route query throws', async () => {
    resolveApiTokenMock.mockResolvedValue({ ownerId: 'acct-1', tokenId: 't-1', readOnly: false });
    listDocumentsMock.mockRejectedValue(D1_INTERNAL);

    const res = await listDocuments();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toContainEqual(['[d1] unavailable route=Get.Documents', D1_INTERNAL]);
  });
});

describe('worker when a request fails otherwise', () => {
  it('answers 500 internal_error when the token lookup throws a bug', async () => {
    const bug = new TypeError('cannot read properties of undefined');
    resolveApiTokenMock.mockRejectedValue(bug);

    const res = await listDocuments();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(errors).toContainEqual(['api error route=Get.Documents', bug]);
  });

  it('counts the crash as an Error·Api·Internal row when telemetry is on', async () => {
    resolveApiTokenMock.mockRejectedValue(new TypeError('boom'));
    insertTelemetryEventsMock.mockRejectedValue(D1_INTERNAL);
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
    } as unknown as ExecutionContext;

    const res = await worker.fetch(
      new Request('https://api.test/api/documents', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
      { ...env(), TELEMETRY_ENABLED: 'true' },
      ctx,
    );
    await Promise.all(pending);

    expect(res.status).toBe(500);
    expect(insertTelemetryEventsMock).toHaveBeenCalledWith(
      expect.anything(),
      [{ category: 'Error', action: 'Api', type: 'Internal.Get.Documents' }],
      expect.any(Number),
    );
    expect(errors).toContainEqual(['[telemetry] crash report failed', D1_INTERNAL]);
  });

  it('answers 503 without a telemetry row when D1 is unavailable', async () => {
    resolveApiTokenMock.mockRejectedValue(D1_INTERNAL);

    const res = await worker.fetch(
      new Request('https://api.test/api/documents', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
      { ...env(), TELEMETRY_ENABLED: 'true' },
    );

    expect(res.status).toBe(503);
    expect(insertTelemetryEventsMock).not.toHaveBeenCalled();
  });

  it('never echoes the error text', async () => {
    resolveApiTokenMock.mockRejectedValue(new Error('D1_ERROR: no such table: secret_table'));

    const res = await listDocuments();

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret_table');
  });
});
