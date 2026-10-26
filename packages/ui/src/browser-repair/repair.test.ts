import { describe, expect, it } from 'vitest';
import { isRepairClearable, REPAIR_KEPT_KEYS } from './kept-keys';
import { repairBrowserStorage } from './repair';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const blocked = (): Storage => {
  throw new DOMException('denied', 'SecurityError');
};

describe('isRepairClearable', () => {
  it('clears LiveDoc settings and caches', () => {
    for (const k of [
      'livedoc:user-preferences:v2',
      'livedoc:recent-diagrams:v1',
      'livedoc:share-password:abc',
      'livedoc:v2:ui-mode',
      'livedoc:stale-chunk-reloads',
      'livedoc-build',
    ]) {
      expect(isRepairClearable(k), k).toBe(true);
    }
  });

  it('keeps identity, per-browser keys and Drive state', () => {
    for (const k of [
      ...REPAIR_KEPT_KEYS,
      'livedoc:v2:drive-state',
      'livedoc:v2:drive-seen:user_a',
      'livedoc:drive-mirror',
    ]) {
      expect(isRepairClearable(k), k).toBe(false);
    }
  });

  it('never touches keys outside its scope, such as a library of its own', () => {
    expect(isRepairClearable('__vendor_environment')).toBe(false);
    expect(isRepairClearable('theme')).toBe(false);
  });
});

describe('repairBrowserStorage', () => {
  it('removes clearable keys from both storages and keeps the rest', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    localStorage.setItem('livedoc:v2:self-id', 'guest');
    localStorage.setItem('livedoc:user-preferences:v2', '{}');
    localStorage.setItem('livedoc:panel-layout:v1', '{}');
    localStorage.setItem('__vendor_x', '1');
    sessionStorage.setItem('livedoc:stale-chunk-reloads', '{}');

    const { cleared } = repairBrowserStorage({ localStorage, sessionStorage });

    expect(cleared.sort()).toEqual([
      'livedoc:panel-layout:v1',
      'livedoc:stale-chunk-reloads',
      'livedoc:user-preferences:v2',
    ]);
    expect(localStorage.getItem('livedoc:v2:self-id')).toBe('guest');
    expect(localStorage.getItem('__vendor_x')).toBe('1');
    expect(sessionStorage.length).toBe(0);
  });

  it('repairs what it can when a storage is blocked', () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem('livedoc:v2:ui-mode', 'x');
    const win = {
      localStorage,
      get sessionStorage() {
        return blocked();
      },
    };
    expect(repairBrowserStorage(win).cleared).toEqual(['livedoc:v2:ui-mode']);
  });

  it('keeps going when one key will not remove', () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem('livedoc:a', '1');
    localStorage.setItem('livedoc:b', '1');
    const remove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = (k: string) => {
      if (k === 'livedoc:a') throw new Error('nope');
      remove(k);
    };
    const { cleared } = repairBrowserStorage({ localStorage, sessionStorage: new MemoryStorage() });
    expect(cleared).toEqual(['livedoc:b']);
  });
});
