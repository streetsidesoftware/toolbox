export function assertCallback(callback: unknown): asserts callback is (...args: never[]) => unknown {
  if (typeof callback !== 'function') throw new TypeError('The callback must be a function.');
}

/** Reject a key that a `WeakMap` can't store. The methods that only look up such a key find nothing instead. */
export function assertWeakKey(key: unknown): void {
  if (Object(key) === key) return;
  if (typeof key === 'symbol' && Symbol.keyFor(key) === undefined) return;
  throw new TypeError('The key must be an object or a non-registered symbol.');
}

/** Turn -0 into 0, as a `Map` does with its keys. */
export function normalizeKey<K>(key: K): K {
  return key === 0 ? (0 as K) : key;
}
