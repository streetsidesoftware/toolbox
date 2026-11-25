import { assertCallback, assertWeakKey } from './checks.ts';

/**
 * A `WeakMap` that can store a value the first time it's asked for, and can be emptied.
 *
 * @example
 * const sizes = new AutoResolveWeakMap<object, number>();
 * const point = { x: 1, y: 2 };
 * sizes.getOrInsertComputed(point, (key) => Object.keys(key).length); // 2, computed and stored
 * sizes.clear();
 * sizes.has(point); // false
 */
export class AutoResolveWeakMap<K extends WeakKey, V> implements WeakMap<K, V> {
  #map: WeakMap<K, V>;

  /**
   * Create a map.
   *
   * @param entries - the keys and values to start with.
   */
  constructor(entries?: Iterable<readonly [K, V]> | null) {
    this.#map = new WeakMap(entries ?? []);
  }

  /** Remove every entry, even when its key is still in use. */
  clear(): void {
    this.#map = new WeakMap();
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one.
   *
   * @param key - the key to remove.
   */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /**
   * Get the value for a key, or `undefined` if there is none.
   *
   * @param key - the key to look up.
   */
  get(key: K): V | undefined {
    return this.#map.get(key);
  }

  /**
   * Get the value for a key, or store the given one when there is none.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  getOrInsert(key: K, value: V): V {
    const found = this.#map.get(key);
    if (found !== undefined || this.#map.has(key)) return found as V;
    this.#map.set(key, value);
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none.
   *
   * - A stored `undefined` counts as a value.
   * - Nothing is stored when the callback throws.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertWeakKey(key);
    assertCallback(callback);
    const found = this.#map.get(key);
    if (found !== undefined || this.#map.has(key)) return found as V;
    const value = callback(key);
    this.#map.set(key, value);
    return value;
  }

  /**
   * Check whether there is a value for a key.
   *
   * @param key - the key to look up.
   */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  set(key: K, value: V): this {
    this.#map.set(key, value);
    return this;
  }

  /** The name `Object.prototype.toString` shows. */
  get [Symbol.toStringTag](): string {
    return 'AutoResolveWeakMap';
  }
}
