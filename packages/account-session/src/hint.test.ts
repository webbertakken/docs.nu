import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_CHANNEL_NAME,
  announceAccountChange,
  onAccountChange,
  readSignedInHint,
  SIGNED_IN_HINT_KEY,
  writeSignedInHint,
} from './hint';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the signed-in hint', () => {
  it('is absent, then follows what the bridge last settled', () => {
    const storage = memoryStorage();
    expect(readSignedInHint(storage)).toBeNull();
    writeSignedInHint(true, storage);
    expect(storage.getItem(SIGNED_IN_HINT_KEY)).toBe('1');
    expect(readSignedInHint(storage)).toBe(true);
    writeSignedInHint(false, storage);
    expect(storage.getItem(SIGNED_IN_HINT_KEY)).toBe('0');
    expect(readSignedInHint(storage)).toBe(false);
  });

  it('reads anything but 1 as not signed in', () => {
    const storage = memoryStorage();
    storage.setItem(SIGNED_IN_HINT_KEY, 'yes');
    expect(readSignedInHint(storage)).toBe(false);
  });

  it('survives a browser that refuses storage', () => {
    const refusing = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    } as unknown as Storage;
    expect(readSignedInHint(refusing)).toBeNull();
    expect(() => writeSignedInHint(true, refusing)).not.toThrow();
  });

  it('uses the page storage by default, and nothing where there is none', () => {
    expect(readSignedInHint()).toBeNull();
    expect(() => writeSignedInHint(true)).not.toThrow();
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    writeSignedInHint(true);
    expect(readSignedInHint()).toBe(true);
  });
});

describe('the account channel between tabs', () => {
  it('nudges the other tabs, carrying nothing they must trust', async () => {
    const listener = vi.fn();
    const stop = onAccountChange(listener);
    const seen = new Promise<unknown>((resolve) => {
      const spy = new BroadcastChannel(ACCOUNT_CHANNEL_NAME);
      spy.onmessage = (event) => {
        spy.close();
        resolve(event.data);
      };
    });
    announceAccountChange(true);
    expect(await seen).toEqual({ signedIn: true });
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(listener).toHaveBeenCalledWith();
    stop();
  });

  it('stops listening when asked', async () => {
    const listener = vi.fn();
    onAccountChange(listener)();
    const other = vi.fn();
    const stopOther = onAccountChange(other);
    announceAccountChange(false);
    await vi.waitFor(() => expect(other).toHaveBeenCalledOnce());
    expect(listener).not.toHaveBeenCalled();
    stopOther();
  });

  it('falls back to the storage event where BroadcastChannel is missing', () => {
    const target = new EventTarget();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('addEventListener', target.addEventListener.bind(target));
    vi.stubGlobal('removeEventListener', target.removeEventListener.bind(target));
    const listener = vi.fn();
    const stop = onAccountChange(listener);
    expect(() => announceAccountChange(true)).not.toThrow();
    target.dispatchEvent(Object.assign(new Event('storage'), { key: 'other' }));
    expect(listener).not.toHaveBeenCalled();
    target.dispatchEvent(Object.assign(new Event('storage'), { key: SIGNED_IN_HINT_KEY }));
    expect(listener).toHaveBeenCalledOnce();
    stop();
    target.dispatchEvent(Object.assign(new Event('storage'), { key: SIGNED_IN_HINT_KEY }));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('does nothing in a context with neither', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('addEventListener', undefined);
    const stop = onAccountChange(vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
