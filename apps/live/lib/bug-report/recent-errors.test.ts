import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECENT_ERRORS_STORAGE_KEY,
  clearRecentClientErrors,
  installRecentErrorCapture,
  recentClientErrors,
  recordClientError,
} from './recent-errors';

// docs/specs/016-platform/bug-reports.md "Context": the newest five client errors, redacted, kept for the session.

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

let storage: Storage;
const at = () => new Date('2026-10-28T10:00:00.000Z');

beforeEach(() => {
  storage = memoryStorage();
  clearRecentClientErrors(storage);
});

describe('recordClientError', () => {
  it('keeps the newest five, newest last, redacted', () => {
    for (let i = 1; i <= 7; i++)
      recordClientError('uncaught', `fail ${i} for ann@example.com`, { storage, now: at });
    const errors = recentClientErrors(storage);
    expect(errors.map((e) => e.message)).toEqual(
      [3, 4, 5, 6, 7].map((i) => `fail ${i} for [email]`),
    );
    expect(errors[0]).toMatchObject({ at: '2026-10-28T10:00:00.000Z', source: 'uncaught' });
  });

  it('survives a page load through session storage', () => {
    recordClientError('render', 'Canvas: boom', { storage, now: at });
    clearRecentClientErrors(undefined);
    expect(recentClientErrors(storage).map((e) => e.message)).toEqual(['Canvas: boom']);
    expect(storage.getItem(RECENT_ERRORS_STORAGE_KEY)).toContain('Canvas: boom');
  });

  it('reads nothing from storage that is not its list', () => {
    storage.setItem(RECENT_ERRORS_STORAGE_KEY, '{"not":"a list"}');
    clearRecentClientErrors(undefined);
    expect(recentClientErrors(storage)).toEqual([]);
    storage.setItem(RECENT_ERRORS_STORAGE_KEY, 'not json');
    expect(recentClientErrors(storage)).toEqual([]);
  });

  it('keeps working without storage', () => {
    recordClientError('api', 'Http500.SaveTab', { storage: undefined, now: at });
    expect(recentClientErrors(undefined).map((e) => e.message)).toEqual(['Http500.SaveTab']);
  });

  it('keeps working when storage throws', () => {
    const throwing = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('full');
      },
    } as Storage;
    recordClientError('api', 'Http500.SaveTab', { storage: throwing, now: at });
    expect(recentClientErrors(undefined).map((e) => e.message)).toEqual(['Http500.SaveTab']);
  });
});

describe('installRecentErrorCapture', () => {
  it('records uncaught errors and unhandled rejections', () => {
    const target = new EventTarget();
    const uninstall = installRecentErrorCapture(target, { storage, now: at });
    const error = new Event('error') as Event & { message: string; error: unknown };
    error.message = 'TypeError: x is undefined';
    target.dispatchEvent(error);
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown };
    rejection.reason = new Error('fetch failed https://docs.nu/api/x');
    target.dispatchEvent(rejection);
    expect(recentClientErrors(storage)).toMatchObject([
      { source: 'uncaught', message: 'TypeError: x is undefined' },
      { source: 'rejection', message: 'Error: fetch failed [url]' },
    ]);
    uninstall();
    target.dispatchEvent(error);
    expect(recentClientErrors(storage)).toHaveLength(2);
  });
});
