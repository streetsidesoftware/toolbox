import { AutoResolveMap } from './AutoResolveMap.ts';
import { AutoResolveWeakMap } from './AutoResolveWeakMap.ts';
import type { CacheMethods, CacheStats } from './cacheStats.ts';
import { StatsTracker } from './cacheStats.ts';
import { assertCallback, assertWeakKey } from './checks.ts';
import { StrongWeakMap } from './StrongWeakMap.ts';
import { WeakWeakMap } from './WeakWeakMap.ts';

// The four classes repeat each other. A shared mixin would need a cast to keep the type parameters, and a pure
// annotation for bundlers to remove an unused class.

/** The same as {@link AutoResolveMap}, with stats on how often it's used. */
export class AutoResolveCache<K, V> extends AutoResolveMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /**
   * Create a cache.
   *
   * The entries it starts with don't count as sets.
   *
   * @param entries - the keys and values to start with.
   */
  constructor(entries?: Iterable<readonly [K, V]> | null) {
    // The `Map` constructor would call `set` before `#stats` exists.
    super();
    for (const [key, value] of entries ?? []) {
      super.set(key, value);
    }
  }

  /**
   * Remove every entry.
   *
   * Counts a call to `clear`. The other counts stay as they are.
   */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one.
   *
   * Counts a call, also when there was none.
   *
   * @param key - the key to remove.
   */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /**
   * Get the value for a key, or `undefined` if there is none.
   *
   * Counts a hit or a miss.
   *
   * @param key - the key to look up.
   */
  override get(key: K): V | undefined {
    const found = super.get(key);
    this.#stats.lookup(found !== undefined || super.has(key));
    return found;
  }

  /**
   * Get the value for a key, or store the given one when there is none.
   *
   * Counts a hit, or a miss and a set.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  override getOrInsert(key: K, value: V): V {
    const found = super.get(key);
    if (found !== undefined || super.has(key)) {
      ++this.#stats.hits;
      return found as V;
    }
    super.set(key, value);
    ++this.#stats.misses;
    ++this.#stats.sets;
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none.
   *
   * - A stored `undefined` counts as a value.
   * - Nothing is stored when the callback throws.
   *
   * Counts a hit, or a miss. A stored result counts as resolved.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertCallback(callback);
    const found = super.get(key);
    if (found !== undefined || super.has(key)) {
      ++this.#stats.hits;
      return found as V;
    }
    ++this.#stats.misses;
    const value = super.getOrInsertComputed(key, callback);
    ++this.#stats.resolved;
    return value;
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /**
   * Get the stats as they are now.
   *
   * Later use of the cache doesn't change the result.
   */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /**
   * Set every count in the stats to 0.
   *
   * The entries stay.
   */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link AutoResolveWeakMap}, with stats on how often it's used. */
export class AutoResolveWeakCache<K extends WeakKey, V> extends AutoResolveWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /**
   * Remove every entry, even when its key is still in use.
   *
   * Counts a call to `clear`. The other counts stay as they are.
   */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one.
   *
   * Counts a call, also when there was none.
   *
   * @param key - the key to remove.
   */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /**
   * Get the value for a key, or `undefined` if there is none.
   *
   * Counts a hit or a miss.
   *
   * @param key - the key to look up.
   */
  override get(key: K): V | undefined {
    const found = super.get(key);
    this.#stats.lookup(found !== undefined || super.has(key));
    return found;
  }

  /**
   * Get the value for a key, or store the given one when there is none.
   *
   * Counts a hit, or a miss and a set.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  override getOrInsert(key: K, value: V): V {
    const found = super.get(key);
    if (found !== undefined || super.has(key)) {
      ++this.#stats.hits;
      return found as V;
    }
    super.set(key, value);
    ++this.#stats.misses;
    ++this.#stats.sets;
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none.
   *
   * - A stored `undefined` counts as a value.
   * - Nothing is stored when the callback throws.
   *
   * Counts a hit, or a miss. A stored result counts as resolved.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertWeakKey(key);
    assertCallback(callback);
    const found = super.get(key);
    if (found !== undefined || super.has(key)) {
      ++this.#stats.hits;
      return found as V;
    }
    ++this.#stats.misses;
    const value = super.getOrInsertComputed(key, callback);
    ++this.#stats.resolved;
    return value;
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /**
   * Get the stats as they are now.
   *
   * Later use of the cache doesn't change the result.
   */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /**
   * Set every count in the stats to 0.
   *
   * The entries stay.
   */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link StrongWeakMap}, with stats on how often it's used. */
export class StrongWeakCache<K, V extends object> extends StrongWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /**
   * Remove every entry.
   *
   * Counts a call to `clear`. The other counts stay as they are.
   */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one whose value hadn't been released.
   *
   * Counts a call, also when there was none.
   *
   * @param key - the key to remove.
   */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /**
   * Get the value for a key, or `undefined` if there is none or it was released.
   *
   * Counts a hit or a miss.
   *
   * @param key - the key to look up.
   */
  override get(key: K): V | undefined {
    const found = super.get(key);
    this.#stats.lookup(found !== undefined);
    return found;
  }

  /**
   * Get the value for a key, or store the given one when there is none or it was released.
   *
   * Counts a hit, or a miss and a set.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  override getOrInsert(key: K, value: V): V {
    const found = super.get(key);
    if (found !== undefined) {
      ++this.#stats.hits;
      return found;
    }
    super.set(key, value);
    ++this.#stats.misses;
    ++this.#stats.sets;
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none or it was released.
   *
   * Nothing is stored when the callback throws.
   *
   * Counts a hit, or a miss. A stored result counts as resolved.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertCallback(callback);
    const found = super.get(key);
    if (found !== undefined) {
      ++this.#stats.hits;
      return found;
    }
    ++this.#stats.misses;
    const value = super.getOrInsertComputed(key, callback);
    ++this.#stats.resolved;
    return value;
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /**
   * Get the stats as they are now.
   *
   * Later use of the cache doesn't change the result.
   */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /**
   * Set every count in the stats to 0.
   *
   * The entries stay.
   */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link WeakWeakMap}, with stats on how often it's used. */
export class WeakWeakCache<K extends WeakKey, V extends object> extends WeakWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /**
   * Remove every entry, even when its key and value are still in use.
   *
   * Counts a call to `clear`. The other counts stay as they are.
   */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one whose value hadn't been released.
   *
   * Counts a call, also when there was none.
   *
   * @param key - the key to remove.
   */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /**
   * Get the value for a key, or `undefined` if there is none or it was released.
   *
   * Counts a hit or a miss.
   *
   * @param key - the key to look up.
   */
  override get(key: K): V | undefined {
    const found = super.get(key);
    this.#stats.lookup(found !== undefined);
    return found;
  }

  /**
   * Get the value for a key, or store the given one when there is none or it was released.
   *
   * Counts a hit, or a miss and a set.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  override getOrInsert(key: K, value: V): V {
    const found = super.get(key);
    if (found !== undefined) {
      ++this.#stats.hits;
      return found;
    }
    super.set(key, value);
    ++this.#stats.misses;
    ++this.#stats.sets;
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none or it was released.
   *
   * Nothing is stored when the callback throws.
   *
   * Counts a hit, or a miss. A stored result counts as resolved.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertWeakKey(key);
    assertCallback(callback);
    const found = super.get(key);
    if (found !== undefined) {
      ++this.#stats.hits;
      return found;
    }
    ++this.#stats.misses;
    const value = super.getOrInsertComputed(key, callback);
    ++this.#stats.resolved;
    return value;
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /**
   * Get the stats as they are now.
   *
   * Later use of the cache doesn't change the result.
   */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /**
   * Set every count in the stats to 0.
   *
   * The entries stay.
   */
  resetStats(): void {
    this.#stats.reset();
  }
}
