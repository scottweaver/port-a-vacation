import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache, type CacheStorage } from './cache';

function memoryStorage(): CacheStorage & { store: Map<string, string>; throwOnSet?: boolean } {
  const store = new Map<string, string>();
  return {
    store,
    throwOnSet: false,
    getItem(key) { return store.has(key) ? (store.get(key) ?? null) : null; },
    setItem(key, value) {
      if (this.throwOnSet) throw new Error('QuotaExceeded');
      store.set(key, value);
    },
    removeItem(key) { store.delete(key); },
  };
}

describe('Cache', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let cache: Cache;

  beforeEach(() => {
    storage = memoryStorage();
    cache = new Cache(storage);
  });

  it('returns null for a missing key', () => {
    expect(cache.get('nope')).toBeNull();
  });

  it('round-trips an arbitrary JSON value', () => {
    const value = { a: 1, b: [2, 3], c: { d: 'four' } };
    cache.set('thing', value);
    expect(cache.get('thing')).toEqual(value);
  });

  it('round-trips an array', () => {
    cache.set('items', [1, 2, 3]);
    expect(cache.get<number[]>('items')).toEqual([1, 2, 3]);
  });

  it('namespaces stored keys with version prefix', () => {
    cache.set('foo', 'bar');
    const keys = [...storage.store.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^port-a:cache:v\d+:foo$/);
  });

  it('returns null and clears corrupted entries on read', () => {
    storage.store.set('port-a:cache:v1:bad', '{not valid json');
    expect(cache.get('bad')).toBeNull();
    expect(storage.store.has('port-a:cache:v1:bad')).toBe(false);
  });

  it('does not throw when storage.setItem throws (quota exceeded)', () => {
    storage.throwOnSet = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => cache.set('big', { hi: 'there' })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('silently drops unserializable values (circular ref)', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(() => cache.set('circular', obj)).not.toThrow();
    expect(cache.get('circular')).toBeNull();
  });

  it('remove deletes an entry', () => {
    cache.set('temp', 1);
    cache.remove('temp');
    expect(cache.get('temp')).toBeNull();
  });

  it('returns null when getItem throws', () => {
    storage.getItem = () => { throw new Error('SecurityError'); };
    expect(cache.get('foo')).toBeNull();
  });
});
