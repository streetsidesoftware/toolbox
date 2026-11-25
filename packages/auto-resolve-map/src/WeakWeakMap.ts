import { assertCallback, assertWeakKey } from './checks.ts';

/**
 * A `WeakMap` that doesn't keep its values alive either, and can be emptied.
 *
 * Once nothing else uses a value, it can be released (garbage collected). Its key is then as if it had never been
 * there.
 *
 * Any look at a value keeps it alive until the current turn of the event loop ends. That includes `has`.
 *
 * @example
 * const parsed = new WeakWeakMap<URL, { hosts: string[] }>();
 * const url = new URL('https://example.com');
 * const result = parsed.getOrInsertComputed(url, (key) => ({ hosts: [key.host] }));
 * parsed.get(url) === result; // true, as long as something uses `result`
 */
export class WeakWeakMap<K extends WeakKey, V extends object> implements WeakMap<K, V> {
  // A released value leaves its WeakRef behind, until the key goes away too.
  #map: WeakMap<K, WeakRef<V>> = new WeakMap();

  /**
   * Create a map.
   *
   * @param entries - the keys and values to start with.
   */
  constructor(entries?: Iterable<readonly [K, V]> | null) {
    for (const [key, value] of entries ?? []) {
      this.#store(key, value);
    }
  }

  /** Remove every entry, even when its key and value are still in use. */
  clear(): void {
    this.#map = new WeakMap();
  }

  /**
   * Remove the entry for a key.
   *
   * The result is `true` when there was one whose value hadn't been released.
   *
   * @param key - the key to remove.
   */
  delete(key: K): boolean {
    const found = this.#find(key);
    this.#map.delete(key);
    return found !== undefined;
  }

  /**
   * Get the value for a key, or `undefined` if there is none or it was released.
   *
   * @param key - the key to look up.
   */
  get(key: K): V | undefined {
    return this.#find(key);
  }

  /**
   * Get the value for a key, or store the given one when there is none or it was released.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  getOrInsert(key: K, value: V): V {
    const found = this.#find(key);
    if (found !== undefined) return found;
    this.#store(key, value);
    return value;
  }

  /**
   * Get the value for a key, or compute and store it when there is none or it was released.
   *
   * Nothing is stored when the callback throws.
   *
   * @param key - the key to look up.
   * @param callback - computes the value. It's called with the key, only when there is no value.
   */
  getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertWeakKey(key);
    assertCallback(callback);
    const found = this.#find(key);
    if (found !== undefined) return found;
    const value = callback(key);
    this.#store(key, value);
    return value;
  }

  /**
   * Check whether there is a value for a key.
   *
   * This keeps the value alive until the current turn of the event loop ends.
   *
   * @param key - the key to look up.
   */
  has(key: K): boolean {
    return this.#find(key) !== undefined;
  }

  /**
   * Store a value for a key, replacing the one it had.
   *
   * @param key - the key to store the value for.
   * @param value - the value to store.
   */
  set(key: K, value: V): this {
    this.#store(key, value);
    return this;
  }

  /** The name `Object.prototype.toString` shows. */
  get [Symbol.toStringTag](): string {
    return 'WeakWeakMap';
  }

  #find(key: K): V | undefined {
    return this.#map.get(key)?.deref();
  }

  #store(key: K, value: V): void {
    this.#map.set(key, new WeakRef(value));
  }
}
