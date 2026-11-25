# @streetsidesoftware/auto-resolve-map

Maps that compute and store a missing value, including maps that don't keep their values alive, and a function that
does the same for a map you already have.

Node.js 22 and 24 don't have `getOrInsert` and `getOrInsertComputed` on `Map` and `WeakMap`. The classes in this package
have them on every supported version.

## Install

```sh
npm install @streetsidesoftware/auto-resolve-map
```

## Usage

### A map you already have

Use `autoResolve` with any object that has `get`, `has` and `set`, such as a `Map` or a `WeakMap`:

```ts
import { autoResolve } from '@streetsidesoftware/auto-resolve-map';

const lengths = new Map<string, number>();

autoResolve(lengths, 'apple', (key) => key.length); // 5, computed and stored
autoResolve(lengths, 'apple', (key) => key.length); // 5, from the map
```

A stored `undefined` counts as a value. Nothing is stored when the callback throws.

### A new map

Pick a class by what it should keep alive:

| Class                | Keeps its keys alive | Keeps its values alive       | Use it as |
| -------------------- | -------------------- | ---------------------------- | --------- |
| `AutoResolveMap`     | Yes                  | Yes                          | `Map`     |
| `AutoResolveWeakMap` | No                   | As long as the key is in use | `WeakMap` |
| `StrongWeakMap`      | Yes                  | No                           | `Map`     |
| `WeakWeakMap`        | No                   | No                           | `WeakMap` |

Each has all the methods of the built-in it's used as, `getOrInsert` and `getOrInsertComputed` included. The two with
weak keys also have `clear`.

```ts
import { AutoResolveMap } from '@streetsidesoftware/auto-resolve-map';

const words = new AutoResolveMap<string, string[]>();

words.getOrInsert('a', []).push('apple');
words.getOrInsert('a', []).push('avocado');
words.getOrInsertComputed('b', loadWords);

words.get('a'); // ['apple', 'avocado']
words.get('b'); // The result of `loadWords('b')`
```

### Values that can be released

`StrongWeakMap` and `WeakWeakMap` share a value for as long as something uses it, and let it go after that:

```ts
import { StrongWeakMap } from '@streetsidesoftware/auto-resolve-map';

const dictionaries = new StrongWeakMap<string, Dictionary>();

const a = dictionaries.getOrInsertComputed('colors', loadDictionary);
const b = dictionaries.getOrInsertComputed('colors', loadDictionary); // The same dictionary as `a`.
```

Once nothing else uses a value, it can be garbage collected at any time:

- After that, `get` and `has` act as if its key had never been there.
- Looping over the entries or values of a `StrongWeakMap` skips it.
- `StrongWeakMap` removes the key itself some time later. Until then, `size` and `keys()` include it.
- Any look at a value, `has` included, keeps it alive until the current turn of the event loop ends.

Each entry of a `StrongWeakMap` has a fixed cost on top of a normal map's, whatever the size of its value. It suits a
small number of large objects, such as dictionaries, and not many small ones.

### Caches with stats

Each class has a version that counts how it's used: `AutoResolveCache`, `AutoResolveWeakCache`, `StrongWeakCache` and
`WeakWeakCache`.

```ts
import { AutoResolveCache } from '@streetsidesoftware/auto-resolve-map';

const cache = new AutoResolveCache<string, number>();

cache.getOrInsertComputed('apple', (key) => key.length);
cache.getOrInsertComputed('apple', (key) => key.length);

cache.stats(); // { hits: 1, misses: 1, resolved: 1, sets: 0, deletes: 0, clears: 0 }
```

| Count      | Goes up when                                    |
| ---------- | ----------------------------------------------- |
| `hits`     | A lookup finds a value                          |
| `misses`   | A lookup finds none                             |
| `resolved` | A value a callback computed is stored           |
| `sets`     | A value is stored by `set`, or by `getOrInsert` |
| `deletes`  | `delete` is called                              |
| `clears`   | `clear` is called                               |

A lookup is `get`, `getOrInsert` or `getOrInsertComputed`. Calling `has` doesn't count.

To start counting again, call `resetStats()`. It leaves the entries alone, as `clear()` leaves the earlier counts alone.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

## License

<!-- @@inject: ../../static/licenseTpl.md#values-file=:package.json -->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->
