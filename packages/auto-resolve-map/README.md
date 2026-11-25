# @streetsidesoftware/auto-resolve-map

Lazy value resolution, `getOrInsert` / `getOrInsertComputed` collections, weak-value maps, and cache instrumentation for
TypeScript and JavaScript.

## Why?

Lazily populating a `Map` or `WeakMap` requires boilerplate, and checking only the result of `get` breaks when
`undefined` is a valid value:

```ts
let size = sizes.get(name);
if (size === undefined && !sizes.has(name)) {
  size = measure(name);
  sizes.set(name, size);
}
```

The `autoResolve` function reduces this to a single, `undefined`-safe call:

```ts
const size = autoResolve(sizes, name, measure);
```

This package also provides:

- Map classes with `getOrInsert` and `getOrInsertComputed`, as in the
  [TC39 upsert proposal](https://github.com/tc39/proposal-upsert), on every supported Node.js version.
- Maps with `WeakRef` values, for memory-sensitive caching or object canonicalization.
- Instrumented `*Cache` variants, for measuring hits and misses.

## Install

```sh
npm install @streetsidesoftware/auto-resolve-map
```

## Overview

| Export                 | Keys   | Values | Description                                                                  |
| ---------------------- | ------ | ------ | ---------------------------------------------------------------------------- |
| `autoResolve`          | Any    | Any    | Function for any map-like object (`get`, `has`, `set`).                      |
| `AutoResolveMap`       | Strong | Strong | `Map` subclass with `getOrInsert` and `getOrInsertComputed`.                 |
| `AutoResolveWeakMap`   | Weak   | Strong | `WeakMap` interface with `getOrInsert`, `getOrInsertComputed` and `clear`.   |
| `StrongWeakMap`        | Strong | Weak   | `Map` interface with `WeakRef` values. Keys of collected values are removed. |
| `WeakWeakMap`          | Weak   | Weak   | `WeakMap` interface with `WeakRef` values and `clear`.                       |
| `AutoResolveCache`     | Strong | Strong | `AutoResolveMap` with lookup and mutation statistics.                        |
| `AutoResolveWeakCache` | Weak   | Strong | `AutoResolveWeakMap` with lookup and mutation statistics.                    |
| `StrongWeakCache`      | Strong | Weak   | `StrongWeakMap` with lookup and mutation statistics.                         |
| `WeakWeakCache`        | Weak   | Weak   | `WeakWeakMap` with lookup and mutation statistics.                           |

All the map classes have `getOrInsert` and `getOrInsertComputed`, with the same semantics as `autoResolve`.

## Usage

### `autoResolve(map, key, callback)`

Resolves and stores a value in any existing `Map`, `WeakMap`, or custom map-like object with `get`, `has` and `set`.

```ts
import { autoResolve } from '@streetsidesoftware/auto-resolve-map';

const lengths = new Map<string, number>();

function measure(word: string): number {
  console.log(`Measuring ${word}`);
  return word.length;
}

autoResolve(lengths, 'apple', measure); // 5 (logs "Measuring apple")
autoResolve(lengths, 'apple', measure); // 5 (from the map)
```

**Semantics:**

- Checks `has(key)` when `get(key)` returns `undefined`, so a stored `undefined` counts as a value.
- If `callback(key)` throws, nothing is stored and the error propagates.

### `AutoResolveMap`

A standard `Map` extended with `getOrInsert(key, value)` and `getOrInsertComputed(key, callback)`.

```ts
import { AutoResolveMap } from '@streetsidesoftware/auto-resolve-map';

const byLetter = new AutoResolveMap<string, string[]>();

for (const word of ['apple', 'banana', 'avocado']) {
  byLetter.getOrInsertComputed(word.charAt(0), () => []).push(word);
}

byLetter.get('a'); // ['apple', 'avocado']
byLetter.get('b'); // ['banana']
```

### `AutoResolveWeakMap`

A `WeakMap`-compatible collection with `getOrInsert`, `getOrInsertComputed` and `clear`. It associates derived data with
an object without preventing garbage collection of that object.

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

hasWord(settings, 'apple'); // true (builds the Set)
hasWord(settings, 'cherry'); // false (reuses the Set)

lookups.clear(); // Releases every Set, even when its Settings object is still in use.
```

### `StrongWeakMap`

A `Map`-compatible collection with strong keys and weak values, backed by `WeakRef` and `FinalizationRegistry`. It caches
large objects, or canonicalizes instances by key, while allowing unused values to be garbage-collected.

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

**Garbage collection and memory semantics:**

- **Object values:** Values must be objects. Store the resolved object, not a promise for it. The promise can be
  collected while its result is still in use.
- **Caller retention:** The map doesn't hold strong references to values. Callers must retain a reference for as long as
  they need the value.
- **Lifetime:** Any lookup, including `has`, and iterating over the values or entries keep a value alive until the end of
  the current turn of the event loop.
- **Key cleanup:** Once a value is collected, lookups and iteration over the values or entries treat the entry as absent.
  The `FinalizationRegistry` removes the key some time later. Until then, `size` and `keys()` include it.
- **Per-entry overhead:** Each entry allocates a `WeakRef` and is registered with a `FinalizationRegistry`. For many small
  objects, prefer `AutoResolveMap`.

### `WeakWeakMap`

A `WeakMap`-compatible collection with weak keys and weak values, and `clear`. Unlike with `AutoResolveWeakMap`, a value
can be garbage-collected while its key is still alive.

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

getLines(file) === current; // true while `current` is strongly referenced
```

Object values, caller retention and lifetime are the same as for `StrongWeakMap`. There is no `FinalizationRegistry`: the
empty `WeakRef` of a collected value stays until the entry is replaced or removed, or its key is collected.

### Cache instrumentation

Each `*Cache` class extends its map class, and tracks lookups and mutations.

```ts
import { AutoResolveCache } from '@streetsidesoftware/auto-resolve-map';

const squares = new AutoResolveCache<number, number>();

for (const n of [1, 2, 1, 2, 1]) {
  squares.getOrInsertComputed(n, () => n * n);
}

squares.stats(); // { hits: 3, misses: 2, resolved: 2, sets: 0, deletes: 0, clears: 0 }
```

| Metric     | Description                                                               |
| ---------- | ------------------------------------------------------------------------- |
| `hits`     | Lookups (`get`, `getOrInsert`, `getOrInsertComputed`) that found a value. |
| `misses`   | Lookups that found no value. A collected value is a miss.                 |
| `resolved` | Values computed by `getOrInsertComputed` and stored.                      |
| `sets`     | Values stored by `set` or `getOrInsert`.                                  |
| `deletes`  | Calls to `delete`.                                                        |
| `clears`   | Calls to `clear`.                                                         |

- Calls to `has` and entries passed to the constructor aren't counted.
- Calling `resetStats()` sets all counters to 0 and keeps the entries.
- Calling `clear()` removes all entries and keeps the other counters.

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
