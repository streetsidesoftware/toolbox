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
export class AutoResolveWeakMap<K extends object, V> implements WeakMap<K, V> {
  #map: WeakMap<K, V>;

  constructor(entries?: Iterable<readonly [K, V]> | null) {
    this.#map = new WeakMap(entries ?? []);
  }

  /** Remove every entry, even when its key is still in use. */
  clear(): void {
    this.#map = new WeakMap();
  }

  /** Remove the entry for a key. Returns `true` if there was one. */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /** Get the value for a key, or `undefined` if there is none. */
  get(key: K): V | undefined {
    return this.#map.get(key);
  }

  /** Get the value for a key, or store the given one when there is none. */
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
   * @param callback - called with the key, only when there is no value.
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

  /** Check whether there is a value for a key. */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /** Store a value for a key, replacing the one it had. */
  set(key: K, value: V): this {
    this.#map.set(key, value);
    return this;
  }

  get [Symbol.toStringTag](): string {
    return 'AutoResolveWeakMap';
  }
}
