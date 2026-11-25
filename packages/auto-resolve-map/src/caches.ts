import { AutoResolveMap } from './AutoResolveMap.ts';
import { AutoResolveWeakMap } from './AutoResolveWeakMap.ts';
import type { CacheMethods, CacheStats } from './cacheStats.ts';
import { StatsTracker } from './cacheStats.ts';
import { StrongWeakMap } from './StrongWeakMap.ts';
import { WeakWeakMap } from './WeakWeakMap.ts';

// The four classes repeat each other. A shared mixin would be a call, and bundlers couldn't remove an unused class.

/** The same as {@link AutoResolveMap}, with stats on how often it's used. */
export class AutoResolveCache<K, V> extends AutoResolveMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  constructor(entries?: Iterable<readonly [K, V]> | null) {
    // The `Map` constructor would call `set` before `#stats` exists.
    super();
    for (const [key, value] of entries ?? []) {
      super.set(key, value);
    }
  }

  /** Remove every entry. The stats stay, apart from counting the call. */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /** Remove the entry for a key. Returns `true` if there was one. */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /** Get the value for a key, or `undefined` if there is none. Counts a hit or a miss. */
  override get(key: K): V | undefined {
    const value = super.get(key);
    this.#stats.lookup(value !== undefined || super.has(key));
    return value;
  }

  /** Get the value for a key, or store the given one when there is none. Counts a hit or a miss. */
  override getOrInsert(key: K, value: V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsert(key, value);
    if (!found) ++this.#stats.sets;
    return result;
  }

  /**
   * Get the value for a key, or compute and store it when there is none. Counts a hit or a miss.
   *
   * Nothing is stored when the callback throws.
   *
   * @param callback - called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsertComputed(key, callback);
    if (!found) ++this.#stats.resolved;
    return result;
  }

  /** Store a value for a key, replacing the one it had. */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /** Get the stats as they are now. Later use of the cache doesn't change the result. */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /** Set every count in the stats to 0. The entries stay. */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link AutoResolveWeakMap}, with stats on how often it's used. */
export class AutoResolveWeakCache<K extends object, V> extends AutoResolveWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /** Remove every entry. The stats stay, apart from counting the call. */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /** Remove the entry for a key. Returns `true` if there was one. */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /** Get the value for a key, or `undefined` if there is none. Counts a hit or a miss. */
  override get(key: K): V | undefined {
    const value = super.get(key);
    this.#stats.lookup(value !== undefined || super.has(key));
    return value;
  }

  /** Get the value for a key, or store the given one when there is none. Counts a hit or a miss. */
  override getOrInsert(key: K, value: V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsert(key, value);
    if (!found) ++this.#stats.sets;
    return result;
  }

  /**
   * Get the value for a key, or compute and store it when there is none. Counts a hit or a miss.
   *
   * Nothing is stored when the callback throws.
   *
   * @param callback - called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsertComputed(key, callback);
    if (!found) ++this.#stats.resolved;
    return result;
  }

  /** Store a value for a key, replacing the one it had. */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /** Get the stats as they are now. Later use of the cache doesn't change the result. */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /** Set every count in the stats to 0. The entries stay. */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link StrongWeakMap}, with stats on how often it's used. */
export class StrongWeakCache<K, V extends object> extends StrongWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /** Remove every entry. The stats stay, apart from counting the call. */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /** Remove the entry for a key. Returns `true` if there was one whose value hadn't been released. */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /** Get the value for a key, or `undefined` if there is none or it was released. Counts a hit or a miss. */
  override get(key: K): V | undefined {
    const value = super.get(key);
    this.#stats.lookup(value !== undefined);
    return value;
  }

  /** Get the value for a key, or store the given one when there is none or it was released. Counts a hit or a miss. */
  override getOrInsert(key: K, value: V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsert(key, value);
    if (!found) ++this.#stats.sets;
    return result;
  }

  /**
   * Get the value for a key, or compute and store it when there is none or it was released. Counts a hit or a miss.
   *
   * Nothing is stored when the callback throws.
   *
   * @param callback - called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsertComputed(key, callback);
    if (!found) ++this.#stats.resolved;
    return result;
  }

  /** Store a value for a key, replacing the one it had. */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /** Get the stats as they are now. Later use of the cache doesn't change the result. */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /** Set every count in the stats to 0. The entries stay. */
  resetStats(): void {
    this.#stats.reset();
  }
}

/** The same as {@link WeakWeakMap}, with stats on how often it's used. */
export class WeakWeakCache<K extends object, V extends object> extends WeakWeakMap<K, V> implements CacheMethods {
  readonly #stats = new StatsTracker();

  /** Remove every entry. The stats stay, apart from counting the call. */
  override clear(): void {
    super.clear();
    ++this.#stats.clears;
  }

  /** Remove the entry for a key. Returns `true` if there was one whose value hadn't been released. */
  override delete(key: K): boolean {
    ++this.#stats.deletes;
    return super.delete(key);
  }

  /** Get the value for a key, or `undefined` if there is none or it was released. Counts a hit or a miss. */
  override get(key: K): V | undefined {
    const value = super.get(key);
    this.#stats.lookup(value !== undefined);
    return value;
  }

  /** Get the value for a key, or store the given one when there is none or it was released. Counts a hit or a miss. */
  override getOrInsert(key: K, value: V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsert(key, value);
    if (!found) ++this.#stats.sets;
    return result;
  }

  /**
   * Get the value for a key, or compute and store it when there is none or it was released. Counts a hit or a miss.
   *
   * Nothing is stored when the callback throws.
   *
   * @param callback - called with the key, only when there is no value.
   */
  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const found = super.has(key);
    this.#stats.lookup(found);
    const result = super.getOrInsertComputed(key, callback);
    if (!found) ++this.#stats.resolved;
    return result;
  }

  /** Store a value for a key, replacing the one it had. */
  override set(key: K, value: V): this {
    super.set(key, value);
    ++this.#stats.sets;
    return this;
  }

  /** Get the stats as they are now. Later use of the cache doesn't change the result. */
  stats(): Readonly<CacheStats> {
    return this.#stats.snapshot();
  }

  /** Set every count in the stats to 0. The entries stay. */
  resetStats(): void {
    this.#stats.reset();
  }
}
