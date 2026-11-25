import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AutoResolveWeakMap, StrongWeakCache, StrongWeakMap, WeakWeakCache, WeakWeakMap } from './index.ts';
import { collectGarbage, releaseBeforeCleanup, releaseUntil, releaseUnused } from './testing/release.ts';
import type { AnyMapClass, StrongKeyMapClass } from './testing/types.ts';

interface Value {
  text: string;
}

const weakValueMaps: Record<string, AnyMapClass> = { StrongWeakMap, StrongWeakCache, WeakWeakMap, WeakWeakCache };
const strongWeakMaps: Record<string, StrongKeyMapClass> = { StrongWeakMap, StrongWeakCache };
const weakKeyMaps: Record<string, AnyMapClass> = { AutoResolveWeakMap, WeakWeakMap };

const value = (): Value => ({ text: 'value' });

for (const [name, MapClass] of Object.entries(weakValueMaps)) {
  describe(`${name} with released values`, () => {
    test('a released value is as if it had never been there', async () => {
      const map = new MapClass<object, Value>();
      const key = {};
      map.set(key, value());
      assert.ok(await releaseUntil(() => !map.has(key)));
      assert.equal(map.get(key), undefined);
      assert.equal(map.delete(key), false);
      const replacement = value();
      assert.equal(
        map.getOrInsertComputed(key, () => replacement),
        replacement,
      );
      assert.equal(map.getOrInsert(key, value()), replacement);
    });

    test('a value in use stays', async () => {
      const map = new MapClass<object, Value>();
      const key = {};
      const used = value();
      map.set(key, used);
      await releaseUnused();
      assert.equal(map.get(key), used);
    });

    test('a looked up value stays until the turn ends', async () => {
      const map = new MapClass<object, Value>();
      const key = {};
      map.set(key, value());
      await Promise.resolve();
      collectGarbage();
      assert.equal(map.has(key), true);
    });
  });
}

for (const [name, MapClass] of Object.entries(strongWeakMaps)) {
  describe(`${name} clean up`, () => {
    test('removes the keys of released values', async () => {
      const map = new MapClass<string, Value>();
      const used = value();
      map.set('used', used);
      for (let i = 0; i < 10; ++i) {
        map.set(`unused ${i}`, value());
      }
      assert.equal(map.size, 11);
      // Checking `size` doesn't look at the values.
      assert.ok(await releaseUntil(() => map.size === 1));
      assert.deepEqual([...map.keys()], ['used']);
      assert.deepEqual([...map], [['used', used]]);
    });

    test('keeps a key whose value was replaced', async () => {
      const map = new MapClass<string, Value>();
      map.set('a', value());
      const replacement = value();
      map.set('a', replacement);
      await releaseUnused();
      await releaseUnused();
      assert.equal(map.get('a'), replacement);
    });

    test('keeps a key that was deleted and set again', async () => {
      const map = new MapClass<string, Value>();
      map.set('a', value());
      map.delete('a');
      const replacement = value();
      map.set('a', replacement);
      await releaseUnused();
      await releaseUnused();
      assert.equal(map.get('a'), replacement);
    });

    test('keeps a key that was cleared and set again', async () => {
      const map = new MapClass<string, Value>();
      map.set('a', value());
      map.clear();
      const replacement = value();
      map.set('a', replacement);
      await releaseUnused();
      await releaseUnused();
      assert.equal(map.get('a'), replacement);
    });

    describe('before the clean up has run', () => {
      test('a released value is skipped, but its key is still counted', async () => {
        const map = new MapClass<string, Value>();
        const used = value();
        map.set('a', value()).set('b', used);
        await releaseBeforeCleanup();
        assert.equal(map.size, 2);
        assert.deepEqual([...map.keys()], ['a', 'b']);
        assert.equal(map.has('a'), false);
        assert.deepEqual([...map], [['b', used]]);
        assert.deepEqual([...map.entries()], [['b', used]]);
        assert.deepEqual([...map.values()], [used]);
        const keys: string[] = [];
        map.forEach((_, key) => keys.push(key));
        assert.deepEqual(keys, ['b']);
      });

      test('delete removes the key, and returns false', async () => {
        const map = new MapClass<string, Value>();
        map.set('a', value());
        await releaseBeforeCleanup();
        assert.equal(map.delete('a'), false);
        assert.equal(map.size, 0);
      });

      test('a key set again is kept', async () => {
        const map = new MapClass<string, Value>();
        map.set('a', value());
        await releaseBeforeCleanup();
        const replacement = value();
        assert.equal(map.getOrInsert('a', replacement), replacement);
        await releaseUnused();
        assert.equal(map.get('a'), replacement);
      });
    });

    test('a paused iterator lets go of the last value it gave', async () => {
      const map = new MapClass<string, Value>();
      for (const iterate of [() => map.values(), () => map.entries()]) {
        map.set('a', value()).set('b', value());
        const iterator = iterate();
        iterator.next();
        assert.ok(await releaseUntil(() => map.size === 0));
        assert.equal(iterator.next().done, true);
      }
    });

    test('lets go of a key removed while its value is in use', async () => {
      const map = new MapClass<object, Value>();
      const used = value();
      for (const remove of [(key: object) => map.delete(key), () => map.clear()]) {
        const ref = new WeakRef({});
        map.set(ref.deref() as object, used);
        remove(ref.deref() as object);
        assert.ok(await releaseUntil(() => ref.deref() === undefined));
      }
      assert.deepEqual(used, value());
    });

    test('lets go of a removed key while a value it had before is in use', async () => {
      const map = new MapClass<object, Value>();
      const used = value();
      const ref = new WeakRef({});
      map.set(ref.deref() as object, used);
      map.set(ref.deref() as object, value());
      map.delete(ref.deref() as object);
      assert.ok(await releaseUntil(() => ref.deref() === undefined));
      assert.deepEqual(used, value());
    });

    test('removes every key of a value with several keys', async () => {
      const map = new MapClass<string, Value>();
      const shared = { current: value() as Value | undefined };
      map.set('a', shared.current as Value);
      map.set('b', shared.current as Value);
      map.delete('a');
      map.set('c', shared.current as Value);
      shared.current = undefined;
      assert.ok(await releaseUntil(() => map.size === 0));
    });
  });
}

describe('weak keys', () => {
  test('AutoResolveWeakMap.clear lets go of values whose key is still in use', async () => {
    const map = new AutoResolveWeakMap<object, Value>();
    const key = {};
    const ref = new WeakRef(map.getOrInsertComputed(key, value));
    await releaseUnused();
    assert.notEqual(ref.deref(), undefined);
    map.clear();
    assert.ok(await releaseUntil(() => ref.deref() === undefined));
    assert.equal(map.has(key), false);
  });

  for (const [name, MapClass] of Object.entries(weakKeyMaps)) {
    test(`${name} lets go of keys`, async () => {
      const map = new MapClass<object, Value>();
      const used = value();
      const ref = new WeakRef({});
      map.set(ref.deref() as object, used);
      assert.ok(await releaseUntil(() => ref.deref() === undefined));
    });
  }
});
