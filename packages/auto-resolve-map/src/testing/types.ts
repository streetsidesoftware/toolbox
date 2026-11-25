/** What every map class has. */
export interface AnyMap<K, V> {
  clear(): void;
  delete(key: K): boolean;
  get(key: K): V | undefined;
  getOrInsert(key: K, value: V): V;
  getOrInsertComputed(key: K, callback: (key: K) => V): V;
  has(key: K): boolean;
  set(key: K, value: V): this;
}

type Entries<K, V> = Iterable<readonly [K, V]> | null;

export type AnyMapClass = new <K extends WeakKey, V extends object>(entries?: Entries<K, V>) => AnyMap<K, V>;
export type StrongValueMapClass = new <K extends WeakKey, V>(entries?: Entries<K, V>) => AnyMap<K, V>;
export type StrongKeyMapClass = new <K, V extends object>(entries?: Entries<K, V>) => Map<K, V>;
export type WeakKeyMapClass = new <K extends WeakKey, V extends object>(entries?: Entries<K, V>) => WeakMap<K, V>;
