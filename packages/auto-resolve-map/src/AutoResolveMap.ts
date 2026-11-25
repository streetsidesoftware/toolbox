import { assertCallback, normalizeKey } from './checks.ts';

/**
 * A `Map` that can store a value the first time it's asked for.
 *
 * @example
 * const lengths = new AutoResolveMap<string, number>();
 * lengths.getOrInsertComputed('apple', (key) => key.length); // 5, computed and stored
 * lengths.get('apple'); // 5
 */
export class AutoResolveMap<K, V> extends Map<K, V> {
  // As in the built-in, these don't go through a subclass's `get`, `has` and `set`.

  /**
   * Get the value for a key, or store the given one when there is none.
   *
   * @param key - the key to look up.
   * @param value - the value to store when there is none.
   */
  getOrInsert(key: K, value: V): V {
    const found = super.get(key);
    if (found !== undefined || super.has(key)) return found as V;
    super.set(key, value);
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
    assertCallback(callback);
    const found = super.get(key);
    if (found !== undefined || super.has(key)) return found as V;
    const value = callback(normalizeKey(key));
    super.set(key, value);
    return value;
  }
}
