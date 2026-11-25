# @streetsidesoftware/auto-resolve-map

Compute a value the first time it's asked for, and get it from a map after that.

Without this package, that takes a few lines, and it's easy to get wrong when a stored value can be `undefined`:

```ts
let size = sizes.get(name);
if (size === undefined && !sizes.has(name)) {
  size = measure(name);
  sizes.set(name, size);
}
```

With it, it's one line:

```ts
const size = autoResolve(sizes, name, measure);
```

There are also maps with this built in. Some of them keep a value only while something uses it, so a large object can be
shared without staying in memory forever. Each comes in a version that counts how well it works as a cache.

## Install

```sh
npm install @streetsidesoftware/auto-resolve-map
```

## Which one do I need?

| You want to                                                         | Use                                       |
| ------------------------------------------------------------------- | ----------------------------------------- |
| Compute missing values in a map you already have                    | [`autoResolve`](#a-map-you-already-have)  |
| Remember a value for a string, a number or any other key            | [`AutoResolveMap`](#values-by-any-key)    |
| Remember a value for an object, until the object is gone            | [`AutoResolveWeakMap`](#values-by-object) |
| Share large objects by name, and let each go when nothing uses it   | [`StrongWeakMap`](#large-objects-by-name) |
| Share large objects by object, and let each go when nothing uses it | [`WeakWeakMap`](#large-objects-by-object) |
| Find out how well one of these maps works as a cache                | [A cache with stats](#a-cache-with-stats) |

## A map you already have

Call `autoResolve` with the map, the key and a function that computes the value:

```ts
import { autoResolve } from '@streetsidesoftware/auto-resolve-map';

const lengths = new Map<string, number>();

function measure(word: string): number {
  console.log(`Measuring ${word}`);
  return word.length;
}

autoResolve(lengths, 'apple', measure); // 5, and logs "Measuring apple"
autoResolve(lengths, 'apple', measure); // 5, from the map
```

It works with a `Map`, a `WeakMap`, or any other object that has `get`, `has` and `set`.

- A stored `undefined` counts as a value.
- If the function throws, nothing is stored.

## Values by any key

Use `AutoResolveMap` when you create the map yourself. It's a `Map` with two more ways to get a value:

- `getOrInsert` stores the value you give it when there is none.
- `getOrInsertComputed` calls your function only when there is none.

```ts
import { AutoResolveMap } from '@streetsidesoftware/auto-resolve-map';

const byLetter = new AutoResolveMap<string, string[]>();

for (const word of ['apple', 'banana', 'avocado']) {
  byLetter.getOrInsertComputed(word[0] ?? '', () => []).push(word);
}

byLetter.get('a'); // ['apple', 'avocado']
byLetter.get('b'); // ['banana']
```

Newer versions of Node.js have these two methods on `Map` and `WeakMap`. Versions 22 and 24 don't. All the maps in this
package have them on every supported version.

## Values by object

Use `AutoResolveWeakMap` to remember something about an object for as long as that object is used:

```ts
import { AutoResolveWeakMap } from '@streetsidesoftware/auto-resolve-map';

interface Settings {
  words: string[];
}

const lookups = new AutoResolveWeakMap<Settings, Set<string>>();

function hasWord(settings: Settings, word: string): boolean {
  const lookup = lookups.getOrInsertComputed(settings, () => new Set(settings.words));
  return lookup.has(word);
}

const settings: Settings = { words: ['apple', 'banana'] };

hasWord(settings, 'apple'); // true, after building the set
hasWord(settings, 'cherry'); // false, from the same set

settings.words.push('cherry');
hasWord(settings, 'cherry'); // false, the set is out of date

lookups.clear();
hasWord(settings, 'cherry'); // true, after building the set again
```

It's a `WeakMap`, so an entry goes away with its key. An object that is used for a long time keeps its value for just as
long. Call `clear` to let go of all the values at once. A plain `WeakMap` has no way to do that.

## Large objects by name

Use `StrongWeakMap` to share objects that take a lot of time to load and a lot of memory to keep. Everyone who asks for
the same name gets the same object, and once nobody uses it, its memory can be freed:

```ts
import { StrongWeakMap } from '@streetsidesoftware/auto-resolve-map';

interface Dictionary {
  language: string;
  words: Set<string>;
}

const dictionaries = new StrongWeakMap<string, Dictionary>();

function loadDictionary(language: string): Dictionary {
  console.log(`Loading ${language}`);
  return { language, words: new Set(['apple', 'banana']) };
}

const first = dictionaries.getOrInsertComputed('en', loadDictionary); // Logs "Loading en"
const second = dictionaries.getOrInsertComputed('en', loadDictionary);

first === second; // true
```

The map doesn't keep the dictionary in memory. Here, `first` and `second` do. Asking for `'en'` after it was freed loads
it again.

It has all the methods of a `Map`. What's different is that a value can disappear:

- Keep a reference to a value for as long as you need it. The map alone won't.
- A value is freed by garbage collection, which runs when it wants to, so it may stay for a while after its last use.
- Calling `get` or `has`, or looping over the values, keeps what it finds until the current turn of the event loop ends.
- Once a value is freed, `get`, `has` and looping treat its key as missing. The map removes the key by itself some time
  later. Until then, `size` and `keys()` include it.

Each entry costs more than one in a normal `Map`, however small the value is. For many small values, use
`AutoResolveMap`.

## Large objects by object

Use `WeakWeakMap` when the key is an object and the value is large. Compared to `AutoResolveWeakMap`, the value can be
freed while its key is still used:

```ts
import { WeakWeakMap } from '@streetsidesoftware/auto-resolve-map';

interface TextFile {
  text: string;
}

const lines = new WeakWeakMap<TextFile, string[]>();

function getLines(file: TextFile): string[] {
  return lines.getOrInsertComputed(file, () => file.text.split('\n'));
}

const file: TextFile = { text: 'one\ntwo' };
const current = getLines(file);

getLines(file) === current; // true, as long as something uses `current`
```

The rules are those of `StrongWeakMap`, except that it's a `WeakMap`: there is no `size` and no looping. Like
`AutoResolveWeakMap`, it has `clear`.

## A cache with stats

To find out if a cache is worth having, use the version of the map that counts:

| Map                  | With stats             |
| -------------------- | ---------------------- |
| `AutoResolveMap`     | `AutoResolveCache`     |
| `AutoResolveWeakMap` | `AutoResolveWeakCache` |
| `StrongWeakMap`      | `StrongWeakCache`      |
| `WeakWeakMap`        | `WeakWeakCache`        |

```ts
import { AutoResolveCache } from '@streetsidesoftware/auto-resolve-map';

const squares = new AutoResolveCache<number, number>();

for (const n of [1, 2, 1, 2, 1]) {
  squares.getOrInsertComputed(n, () => n * n);
}

squares.stats(); // { hits: 3, misses: 2, resolved: 2, sets: 0, deletes: 0, clears: 0 }
```

Three of the five lookups were answered from the cache, and the other two did the work.

| Count      | What it counts                                   | What it tells you                      |
| ---------- | ------------------------------------------------ | -------------------------------------- |
| `hits`     | Lookups that found a value                       | How much work the cache saved          |
| `misses`   | Lookups that found none                          | With `hits`, whether it's worth having |
| `resolved` | Values a function computed, and the cache stored | How often the work was done            |
| `sets`     | Values stored by `set`, or by `getOrInsert`      | How much is stored without a function  |
| `deletes`  | Calls to `delete`                                | Whether it's emptied too often         |
| `clears`   | Calls to `clear`                                 | Whether it's emptied too often         |

A lookup is `get`, `getOrInsert` or `getOrInsertComputed`. Calling `has` isn't counted, and neither are the entries a
cache starts with.

Call `resetStats` to start counting from 0, for example to measure only one part of a program. The entries stay. Calling
`clear` removes the entries, and keeps the counts.

## Requirements

<!--- @@inject: ../../static/requirements.md#values-file=:package.json --->

Requires Node.js >=22.18.0. ESM only.

<!--- @@inject-end: ../../static/requirements.md#values-file=:package.json --->

## License

<!--- @@inject: ../../static/licenseTpl.md#values-file=:package.json --->

MIT

<!--- @@inject-end: ../../static/licenseTpl.md#values-file=:package.json --->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

If our tools save you time, please consider supporting their development.

Please show your support through one of the following sites:

<p align="left">
  <a href="https://github.com/sponsors/streetsidesoftware" title="GitHub Sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/github-sponsor-dark.png" /><img alt="GitHub Sponsor" src="https://streetsidesoftware.com/img/sponsor/github-sponsor.png" width="180" /></picture></a> &nbsp; <a href="https://thanks.dev/u/gh/streetsidesoftware" title="thanks.dev"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/thanks-dev-dark.png" /><img alt="thanks.dev" src="https://streetsidesoftware.com/img/sponsor/thanks-dev.png" width="180" /></picture></a> &nbsp; <a href="https://opencollective.com/cspell" title="Open Collective"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/open-collective-dark.png" /><img alt="Open Collective" src="https://streetsidesoftware.com/img/sponsor/open-collective.png" width="180" /></picture></a> &nbsp; <a href="https://streetsidesoftware.com/sponsor/" title="Street Side Software"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/cspell-dark.png" /><img alt="CSpell" src="https://streetsidesoftware.com/img/sponsor/cspell.png" width="180" /></picture></a>
</p>

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: ../../static/footer.md --->
