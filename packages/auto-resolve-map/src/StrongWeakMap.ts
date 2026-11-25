import { assertCallback, normalizeKey } from './checks.ts';

interface Note<K, V extends object> {
  key: K;
  ref: WeakRef<V>;
}

/**
 * A `Map` that doesn't keep its values alive.
 *
 * Once nothing else uses a value, it can be released (garbage collected). Its key is then as if it had never been
 * there. The key itself is removed some time later, so `size` and `keys` may still include it.
 *
 * Any look at a value keeps it alive until the current turn of the event loop ends. That includes `has` and looping
 * over the map.
 *
 * Each entry has a fixed cost on top of a normal map's, whatever the size of its value. It suits a small number of
 * large objects.
 *
 * @example
 * const dictionaries = new StrongWeakMap<string, { words: string[] }>();
 * const colors = dictionaries.getOrInsertComputed('colors', () => ({ words: ['blue', 'red'] }));
 * dictionaries.get('colors') === colors; // true, as long as something uses `colors`
 */
export class StrongWeakMap<K, V extends object> implements Map<K, V> {
  readonly #map: Map<K, WeakRef<V>> = new Map();

  // Keep it an instance field. Bundlers don't remove an unused class with a static one.
  readonly #registry: FinalizationRegistry<Note<K, V>> = new FinalizationRegistry(({ key, ref }) => {
    // Only a safeguard: replacing or removing an entry cancels its note.
    if (this.#map.get(key) === ref) this.#map.delete(key);
  });

  constructor(entries?: Iterable<readonly [K, V]> | null) {
    for (const [key, value] of entries ?? []) {
      this.#store(key, value);
    }
  }

  /** The number of keys. It may include keys whose value was released. */
  get size(): number {
    return this.#map.size;
  }

  /** Remove every entry. */
  clear(): void {
    for (const ref of this.#map.values()) {
      this.#registry.unregister(ref);
    }
    this.#map.clear();
  }

  /** Remove the entry for a key. Returns `true` if there was one whose value hadn't been released. */
  delete(key: K): boolean {
    const ref = this.#map.get(key);
    if (!ref) return false;
    this.#registry.unregister(ref);
    this.#map.delete(key);
    return ref.deref() !== undefined;
  }

  /** Get the key and value of each entry whose value wasn't released. */
  entries(): MapIterator<[K, V]> {
    return this.#iterate((key, value) => [key, value]);
  }

  /** Call a function for each entry whose value wasn't released. */
  forEach(callback: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    assertCallback(callback);
    for (const [key, value] of this.entries()) {
      callback.call(thisArg, value, key, this);
    }
  }

  /** Get the value for a key, or `undefined` if there is none or it was released. */
  get(key: K): V | undefined {
    return this.#find(key);
  }

  /** Get the value for a key, or store the given one when there is none or it was released. */
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
   * @param callback - called with the key, only when there is no value.
   */
  getOrInsertComputed(key: K, callback: (key: K) => V): V {
    assertCallback(callback);
    const found = this.#find(key);
    if (found !== undefined) return found;
    const value = callback(normalizeKey(key));
    this.#store(key, value);
    return value;
  }

  /**
   * Check whether there is a value for a key.
   *
   * This keeps the value alive until the current turn of the event loop ends.
   */
  has(key: K): boolean {
    return this.#find(key) !== undefined;
  }

  /** Get the keys. They may include keys whose value was released. */
  keys(): MapIterator<K> {
    return this.#map.keys();
  }

  /** Store a value for a key, replacing the one it had. */
  set(key: K, value: V): this {
    this.#store(key, value);
    return this;
  }

  /** Get the values that weren't released. */
  values(): MapIterator<V> {
    return this.#iterate((_, value) => value);
  }

  /** Get the key and value of each entry whose value wasn't released. */
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  get [Symbol.toStringTag](): string {
    return 'StrongWeakMap';
  }

  #find(key: K): V | undefined {
    return this.#map.get(key)?.deref();
  }

  /** Not a generator, which would keep the last value alive while paused, and couldn't be continued after a `break`. */
  #iterate<T>(pick: (key: K, value: V) => T): MapIterator<T> {
    const entries = this.#map.entries();
    const iterator: Iterator<T, undefined> = {
      next() {
        for (const [key, ref] of entries) {
          const value = ref.deref();
          if (value !== undefined) return { done: false, value: pick(key, value) };
        }
        return { done: true, value: undefined };
      },
    };
    return Iterator.from(iterator);
  }

  #store(key: K, value: V): void {
    const ref = new WeakRef(value);
    const previous = this.#map.get(key);
    if (previous) this.#registry.unregister(previous);
    this.#map.set(key, ref);
    this.#registry.register(value, { key, ref }, ref);
  }
}
