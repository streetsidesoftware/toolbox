import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  AutoResolveCache,
  AutoResolveMap,
  AutoResolveWeakCache,
  AutoResolveWeakMap,
  StrongWeakCache,
  StrongWeakMap,
  WeakWeakCache,
  WeakWeakMap,
} from './index.ts';
import type { AnyMapClass, StrongKeyMapClass, StrongValueMapClass, WeakKeyMapClass } from './testing/types.ts';

interface Value {
  n: number;
}

type Key = { id: string };

// Each class can be used as the built-in it's named after.
const strongKeyMaps: Record<string, StrongKeyMapClass> = {
  AutoResolveMap,
  AutoResolveCache,
  StrongWeakMap,
  StrongWeakCache,
};

const weakKeyMaps: Record<string, WeakKeyMapClass> = {
  AutoResolveWeakMap,
  AutoResolveWeakCache,
  WeakWeakMap,
  WeakWeakCache,
};

const strongValueMaps: Record<string, StrongValueMapClass> = {
  AutoResolveMap,
  AutoResolveCache,
  AutoResolveWeakMap,
  AutoResolveWeakCache,
};

const weakValueMaps: Record<string, AnyMapClass> = {
  StrongWeakMap,
  StrongWeakCache,
  WeakWeakMap,
  WeakWeakCache,
};

const maps: Record<string, AnyMapClass> = { ...strongValueMaps, ...weakValueMaps };

const keyA: Key = { id: 'a' };
const keyB: Key = { id: 'b' };
const one: Value = { n: 1 };
const two: Value = { n: 2 };

for (const [name, MapClass] of Object.entries(maps)) {
  describe(name, () => {
    test('starts with the given entries', () => {
      const map = new MapClass([
        [keyA, one],
        [keyB, two],
      ]);
      assert.equal(map.get(keyA), one);
      assert.equal(map.get(keyB), two);
    });

    test('starts empty without entries', () => {
      assert.equal(new MapClass<Key, Value>().has(keyA), false);
      assert.equal(new MapClass<Key, Value>(null).has(keyA), false);
    });

    test('set, get and has', () => {
      const map = new MapClass<Key, Value>();
      assert.equal(map.get(keyA), undefined);
      assert.equal(map.set(keyA, one), map);
      assert.equal(map.get(keyA), one);
      assert.equal(map.has(keyA), true);
      assert.equal(map.has(keyB), false);
    });

    test('set replaces a value', () => {
      const map = new MapClass([[keyA, one]]);
      map.set(keyA, two);
      assert.equal(map.get(keyA), two);
    });

    test('delete returns whether there was an entry', () => {
      const map = new MapClass([[keyA, one]]);
      assert.equal(map.delete(keyA), true);
      assert.equal(map.delete(keyA), false);
      assert.equal(map.has(keyA), false);
    });

    test('clear removes every entry', () => {
      const map = new MapClass([
        [keyA, one],
        [keyB, two],
      ]);
      map.clear();
      assert.equal(map.has(keyA), false);
      assert.equal(map.has(keyB), false);
      map.set(keyA, two);
      assert.equal(map.get(keyA), two);
    });

    test('getOrInsert stores a value only when there is none', () => {
      const map = new MapClass<Key, Value>();
      assert.equal(map.getOrInsert(keyA, one), one);
      assert.equal(map.getOrInsert(keyA, two), one);
      assert.equal(map.get(keyA), one);
    });

    test('getOrInsertComputed computes a value only when there is none', () => {
      const map = new MapClass<Key, Value>();
      const keys: Key[] = [];
      const compute = (key: Key) => (keys.push(key), one);
      assert.equal(map.getOrInsertComputed(keyA, compute), one);
      assert.equal(map.getOrInsertComputed(keyA, compute), one);
      assert.equal(map.get(keyA), one);
      assert.deepEqual(keys, [keyA]);
    });

    test('getOrInsertComputed stores nothing when the callback throws', () => {
      const map = new MapClass<Key, Value>();
      assert.throws(
        () =>
          map.getOrInsertComputed(keyA, () => {
            throw new Error('failed');
          }),
        /failed/,
      );
      assert.equal(map.has(keyA), false);
    });

    test("getOrInsertComputed prefers the callback's result over a value it set itself", () => {
      const map = new MapClass<Key, Value>();
      const value = map.getOrInsertComputed(keyA, (key) => {
        map.set(key, one);
        return two;
      });
      assert.equal(value, two);
      assert.equal(map.get(keyA), two);
    });

    test('getOrInsertComputed stores the result when the callback clears the map', () => {
      const map = new MapClass([[keyB, two]]);
      map.getOrInsertComputed(keyA, () => {
        map.clear();
        return one;
      });
      assert.equal(map.get(keyA), one);
      assert.equal(map.has(keyB), false);
    });

    test('getOrInsertComputed needs a function, even when there is a value', () => {
      const map = new MapClass([[keyA, one]]);
      const notAFunction = 'one' as unknown as () => Value;
      assert.throws(() => map.getOrInsertComputed(keyA, notAFunction), TypeError);
      assert.throws(() => map.getOrInsertComputed(keyB, notAFunction), TypeError);
    });

    test("a subclass's own get, has and set aren't called", () => {
      class Sub extends MapClass<Key, Value> {
        override get(_key: Key): Value | undefined {
          return assert.fail();
        }
        override has(_key: Key): boolean {
          return assert.fail();
        }
        override set(_key: Key, _value: Value): this {
          return assert.fail();
        }
      }
      const map = new Sub();
      assert.equal(map.getOrInsert(keyA, one), one);
      assert.equal(
        map.getOrInsertComputed(keyB, () => two),
        two,
      );
    });
  });
}

for (const [name, MapClass] of Object.entries(strongKeyMaps)) {
  describe(`${name} as a Map`, () => {
    const entries = (): Map<string, Value> =>
      new MapClass<string, Value>([
        ['a', one],
        ['b', two],
      ]);

    test('size', () => {
      const map = entries();
      assert.equal(map.size, 2);
      map.delete('a');
      assert.equal(map.size, 1);
      map.clear();
      assert.equal(map.size, 0);
    });

    test('loops over entries, keys and values in insertion order', () => {
      const map = entries();
      const expected = [
        ['a', one],
        ['b', two],
      ];
      assert.deepEqual([...map], expected);
      assert.deepEqual([...map.entries()], expected);
      assert.deepEqual([...map.keys()], ['a', 'b']);
      assert.deepEqual([...map.values()], [one, two]);
    });

    test('forEach passes the value, the key, the map and the given this', () => {
      const map = entries();
      const thisArg = {};
      const calls: unknown[][] = [];
      map.forEach(function (this: unknown, ...args) {
        calls.push([this, ...args]);
      }, thisArg);
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[0]?.slice(1, 3), [one, 'a']);
      assert.deepEqual(calls[1]?.slice(1, 3), [two, 'b']);
      for (const call of calls) {
        assert.equal(call[0], thisArg);
        assert.equal(call[3], map);
      }
    });

    test('entries can be deleted and added while looping', () => {
      const map = entries();
      const seen: string[] = [];
      for (const [key] of map) {
        seen.push(key);
        if (key === 'a') {
          map.delete('b');
          map.set('c', one);
        }
      }
      assert.deepEqual(seen, ['a', 'c']);
    });

    test('an iterator can be continued after stopping early', () => {
      const map = entries();
      const iterators = [map.entries(), map.keys(), map.values(), map[Symbol.iterator]()];
      const all = [[...map.entries()], [...map.keys()], [...map.values()], [...map]];
      for (const [i, iterator] of iterators.entries()) {
        const [first] = iterator;
        const [second] = iterator;
        assert.deepEqual([first, second], all[i]);
      }
    });

    test('an iterator has the iterator helpers', () => {
      const ns = entries()
        .values()
        .map(({ n }) => n)
        .toArray();
      assert.deepEqual(ns, [1, 2]);
    });

    test('forEach needs a function, even when the map is empty', () => {
      const notAFunction = 'one' as unknown as () => void;
      assert.throws(() => new MapClass<string, Value>().forEach(notAFunction), TypeError);
    });

    test('a key of -0 becomes 0', () => {
      const map = new MapClass<number, Value>();
      let received: number | undefined;
      map.getOrInsertComputed(-0, (key) => {
        received = key;
        return one;
      });
      assert.ok(Object.is(received, 0));
      map.getOrInsert(-0, two);
      assert.ok(Object.is([...map.keys()][0], 0));
      assert.equal(map.size, 1);
    });
  });
}

for (const [name, MapClass] of Object.entries(weakKeyMaps)) {
  describe(`${name} as a WeakMap`, () => {
    for (const badKey of ['a', 1, null, undefined, Symbol.for('registered')]) {
      test(`rejects ${String(badKey)} as a key before calling the callback`, () => {
        const map = new MapClass<Key, Value>();
        const key = badKey as unknown as Key;
        assert.throws(() => map.getOrInsertComputed(key, () => assert.fail()), TypeError);
        assert.throws(() => map.getOrInsert(key, one), TypeError);
        assert.throws(() => map.set(key, one), TypeError);
        assert.equal(map.has(key), false);
        assert.equal(map.get(key), undefined);
        assert.equal(map.delete(key), false);
      });
    }

    test('accepts functions and non-registered symbols as keys', () => {
      const map = new MapClass<object, Value>();
      for (const key of [() => {}, Symbol('key') as unknown as object]) {
        assert.equal(
          map.getOrInsertComputed(key, () => one),
          one,
        );
        assert.equal(map.get(key), one);
      }
    });
  });
}

for (const [name, MapClass] of Object.entries(strongValueMaps)) {
  test(`${name} counts a stored undefined as a value`, () => {
    const map = new MapClass<Key, Value | undefined>([[keyA, undefined]]);
    assert.equal(map.getOrInsert(keyA, one), undefined);
    assert.equal(
      map.getOrInsertComputed(keyA, () => one),
      undefined,
    );
    assert.equal(map.has(keyA), true);
  });
}

for (const [name, MapClass] of Object.entries(weakValueMaps)) {
  test(`${name} rejects a value that isn't an object, and keeps the one it had`, () => {
    const map = new MapClass<Key, Value>([[keyA, one]]);
    const notAnObject = 1 as unknown as Value;
    assert.throws(() => map.set(keyA, notAnObject), TypeError);
    assert.throws(() => map.getOrInsertComputed(keyB, () => notAnObject), TypeError);
    assert.equal(map.get(keyA), one);
    assert.equal(map.has(keyB), false);
  });

  test(`${name} can have a value as its own key`, () => {
    const map = new MapClass<Value, Value>();
    map.set(one, one);
    assert.equal(map.get(one), one);
  });
}
