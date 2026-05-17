// Versioned localStorage cache for last-known server state. Drives offline
// hydration so the app renders cached data immediately on reopen and only
// then refreshes from the network.
//
// Bump CACHE_VERSION whenever the shape of any cached payload changes — old
// entries become inaccessible and get garbage-collected by browsers over time.
// We deliberately don't try to migrate; the cache is regenerated from the
// server on the next successful fetch.

export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const CACHE_VERSION = 1;
const KEY_PREFIX = `port-a:cache:v${CACHE_VERSION}:`;

const noopStorage: CacheStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

export class Cache {
  constructor(private storage: CacheStorage) {}

  get<T>(name: string): T | null {
    let raw: string | null;
    try {
      raw = this.storage.getItem(KEY_PREFIX + name);
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupted entry — drop it so we don't keep failing on every read.
      this.remove(name);
      return null;
    }
  }

  set<T>(name: string, value: T): void {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return;
    }
    try {
      this.storage.setItem(KEY_PREFIX + name, serialized);
    } catch (e) {
      // Quota exceeded or storage disabled — log and continue. We treat the
      // cache as best-effort, never a hard dependency.
      console.warn('cache: failed to set', name, e);
    }
  }

  remove(name: string): void {
    try {
      this.storage.removeItem(KEY_PREFIX + name);
    } catch { /* noop */ }
  }
}

export const cache = new Cache(
  typeof localStorage !== 'undefined' ? localStorage : noopStorage,
);
