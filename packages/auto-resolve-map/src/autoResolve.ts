/** Any object that can look up and store values by key, such as a `Map` or a `WeakMap`. */
export interface MapLike<K, V> {
  /** Get the value for a key, or `undefined` if there is none. */
  get(key: K): V | undefined;
  /** Check whether there is a value for a key. */
  has(key: K): boolean;
  /** Store a value for a key. */
  set(key: K, value: V): unknown;
}

/**
 * Get the value for a key, or compute and store it when there is none.
 *
 * It works with a map you already have. To create a map with this built in, use {@link AutoResolveMap}.
 *
 * - A stored `undefined` counts as a value.
 * - Nothing is stored when the callback throws.
 *
 * @param callback - called with the key, only when there is no value.
 * @example
 * const lengths = new Map<string, number>();
 * autoResolve(lengths, 'apple', (key) => key.length); // 5, computed and stored
 * autoResolve(lengths, 'apple', (key) => key.length); // 5, from the map
 */
export function autoResolve<K, V>(map: MapLike<K, V>, key: K, callback: (key: K) => V): V {
  const found = map.get(key);
  if (found !== undefined || map.has(key)) return found as V;
  const value = callback(key);
  map.set(key, value);
  return value;
}
