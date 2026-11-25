import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { autoResolve, AutoResolveCache, AutoResolveWeakCache, StrongWeakCache, WeakWeakCache } from './index.ts';
import type { CacheMethods, CacheStats } from './index.ts';
import { releaseUntil } from './testing/release.ts';
import type { AnyMap } from './testing/types.ts';

interface Value {
  n: number;
}

type AnyCache<K, V> = AnyMap<K, V> & CacheMethods;
type Entries<K, V> = Iterable<readonly [K, V]> | null;
type StrongValueCacheClass = new <K extends object, V>(entries?: Entries<K, V>) => AnyCache<K, V>;
type CacheClass = new <K extends object, V extends object>(entries?: Entries<K, V>) => AnyCache<K, V>;
type StrongKeyCacheClass = new <K, V extends object>(entries?: Entries<K, V>) => Map<K, V> & CacheMethods;

const strongValueCaches: Record<string, StrongValueCacheClass> = { AutoResolveCache, AutoResolveWeakCache };
const weakValueCaches: Record<string, CacheClass> = { StrongWeakCache, WeakWeakCache };
const strongKeyCaches: Record<string, StrongKeyCacheClass> = { AutoResolveCache, StrongWeakCache };
const caches: Record<string, CacheClass> = { ...strongValueCaches, ...weakValueCaches };

const noStats: CacheStats = { hits: 0, misses: 0, resolved: 0, sets: 0, deletes: 0, clears: 0 };

const keyA = { id: 'a' };
const keyB = { id: 'b' };
const one: Value = { n: 1 };
const two: Value = { n: 2 };

for (const [name, CacheClass] of Object.entries(caches)) {
  describe(name, () => {
    test('starts at 0, also with entries', () => {
      const cache = new CacheClass([[keyA, one]]);
      assert.equal(cache.has(keyA), true);
      assert.deepEqual(cache.stats(), noStats);
    });

    test('get counts hits and misses', () => {
      const cache = new CacheClass([[keyA, one]]);
      cache.get(keyA);
      cache.get(keyA);
      cache.get(keyB);
      assert.deepEqual(cache.stats(), { ...noStats, hits: 2, misses: 1 });
    });

    test("has doesn't count", () => {
      const cache = new CacheClass([[keyA, one]]);
      cache.has(keyA);
      cache.has(keyB);
      assert.deepEqual(cache.stats(), noStats);
    });

    test('getOrInsert counts a miss and a set, then hits', () => {
      const cache = new CacheClass<object, Value>();
      cache.getOrInsert(keyA, one);
      assert.deepEqual(cache.stats(), { ...noStats, misses: 1, sets: 1 });
      cache.getOrInsert(keyA, two);
      assert.deepEqual(cache.stats(), { ...noStats, hits: 1, misses: 1, sets: 1 });
    });

    test('getOrInsertComputed counts a miss and a resolved, then hits', () => {
      const cache = new CacheClass<object, Value>();
      cache.getOrInsertComputed(keyA, () => one);
      assert.deepEqual(cache.stats(), { ...noStats, misses: 1, resolved: 1 });
      cache.getOrInsertComputed(keyA, () => two);
      assert.deepEqual(cache.stats(), { ...noStats, hits: 1, misses: 1, resolved: 1 });
    });

    test("getOrInsertComputed doesn't count a resolved when the callback throws", () => {
      const cache = new CacheClass<object, Value>();
      assert.throws(
        () =>
          cache.getOrInsertComputed(keyA, () => {
            throw new Error('failed');
          }),
        /failed/,
      );
      assert.deepEqual(cache.stats(), { ...noStats, misses: 1 });
    });

    test('set, delete and clear count calls', () => {
      const cache = new CacheClass<object, Value>();
      cache.set(keyA, one).set(keyA, two);
      cache.delete(keyA);
      cache.delete(keyB);
      cache.clear();
      assert.deepEqual(cache.stats(), { ...noStats, sets: 2, deletes: 2, clears: 1 });
    });

    test('clear leaves the stats alone', () => {
      const cache = new CacheClass([[keyA, one]]);
      cache.get(keyA);
      cache.clear();
      assert.deepEqual(cache.stats(), { ...noStats, hits: 1, clears: 1 });
    });

    test('resetStats leaves the entries alone', () => {
      const cache = new CacheClass<object, Value>();
      cache.set(keyA, one);
      cache.get(keyA);
      cache.resetStats();
      assert.deepEqual(cache.stats(), noStats);
      assert.equal(cache.get(keyA), one);
      assert.deepEqual(cache.stats(), { ...noStats, hits: 1 });
    });

    test("a result of stats doesn't change later", () => {
      const cache = new CacheClass<object, Value>();
      const before = cache.stats();
      cache.get(keyA);
      cache.resetStats();
      cache.get(keyB);
      assert.deepEqual(before, noStats);
    });

    test('autoResolve counts as a get and a set', () => {
      const cache = new CacheClass<object, Value>();
      autoResolve(cache, keyA, () => one);
      autoResolve(cache, keyA, () => two);
      assert.deepEqual(cache.stats(), { ...noStats, hits: 1, misses: 1, sets: 1 });
    });
  });
}

for (const [name, CacheClass] of Object.entries(strongValueCaches)) {
  test(`${name} counts finding a stored undefined as a hit`, () => {
    const cache = new CacheClass<object, undefined>([[keyA, undefined]]);
    cache.get(keyA);
    cache.getOrInsert(keyA, undefined);
    cache.getOrInsertComputed(keyA, () => undefined);
    assert.deepEqual(cache.stats(), { ...noStats, hits: 3 });
  });
}

for (const [name, CacheClass] of Object.entries(weakValueCaches)) {
  test(`${name} counts looking up a released value as a miss`, async () => {
    const cache = new CacheClass<object, Value>();
    cache.set(keyA, { n: 3 });
    assert.ok(await releaseUntil(() => !cache.has(keyA)));
    cache.get(keyA);
    cache.getOrInsertComputed(keyA, () => one);
    assert.deepEqual(cache.stats(), { ...noStats, sets: 1, misses: 2, resolved: 1 });
  });
}

describe('looping', () => {
  for (const [name, CacheClass] of Object.entries(strongKeyCaches)) {
    test(`${name} doesn't count it`, () => {
      const cache = new CacheClass([[keyA, one]]);
      cache.forEach(() => {});
      assert.equal([...cache].length + [...cache.values()].length + [...cache.keys()].length + cache.size, 4);
      assert.deepEqual(cache.stats(), noStats);
    });
  }
});
