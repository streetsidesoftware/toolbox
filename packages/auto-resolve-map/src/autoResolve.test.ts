import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { autoResolve } from './index.ts';

describe('autoResolve', () => {
  test('computes and stores a missing value', () => {
    const map = new Map<string, number>();
    assert.equal(
      autoResolve(map, 'apple', (key) => key.length),
      5,
    );
    assert.equal(map.get('apple'), 5);
  });

  test("doesn't call the callback for a stored value", () => {
    const map = new Map([['a', 1]]);
    assert.equal(
      autoResolve(map, 'a', () => assert.fail()),
      1,
    );
  });

  test('a stored undefined counts as a value', () => {
    const map = new Map<string, number | undefined>([['a', undefined]]);
    assert.equal(
      autoResolve(map, 'a', () => 1),
      undefined,
    );
  });

  test('stores nothing when the callback throws', () => {
    const map = new Map<string, number>();
    assert.throws(
      () =>
        autoResolve(map, 'a', () => {
          throw new Error('failed');
        }),
      /failed/,
    );
    assert.equal(map.has('a'), false);
  });

  test("the callback's result wins over a value it set itself", () => {
    const map = new Map<string, number>();
    const value = autoResolve(map, 'a', (key) => {
      map.set(key, 1);
      return 2;
    });
    assert.equal(value, 2);
    assert.equal(map.get('a'), 2);
  });

  test('works with a WeakMap', () => {
    const map = new WeakMap<object, number>();
    const key = {};
    autoResolve(map, key, () => 1);
    assert.equal(map.get(key), 1);
  });

  test('works with any object that has get, has and set', () => {
    const values: Record<string, number> = {};
    const map = {
      get: (key: string) => values[key],
      has: (key: string) => key in values,
      set: (key: string, value: number) => void (values[key] = value),
    };
    autoResolve(map, 'a', () => 1);
    assert.deepEqual(values, { a: 1 });
  });

  test('the map alone decides the types', () => {
    class Animal {
      name = 'animal';
    }
    class Dog extends Animal {
      bark(): string {
        return 'woof';
      }
    }
    const numbers = new Map<string, number>();
    // @ts-expect-error: the map doesn't hold undefined
    autoResolve(numbers, 'a', () => undefined);
    // @ts-expect-error: the map doesn't hold null
    autoResolve(numbers, 'b', () => null);
    // @ts-expect-error: not every Animal is a Dog
    autoResolve(new Map<string, Dog>(), 'a', () => new Animal());
    // @ts-expect-error: not every Animal is a Dog
    autoResolve(new Map<Dog, number>(), new Animal(), () => 1);
    // A subtype fits.
    autoResolve(new Map<Animal, Animal>(), new Dog(), () => new Dog());
  });
});
