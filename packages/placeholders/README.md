# @streetsidesoftware/placeholders

Replace placeholders such as `{@ name @}` in a string with values, and find the ones that are left.

## Install

```sh
npm install @streetsidesoftware/placeholders
```

Requires Node.js 22.18 or later. ESM only.

## Usage

```ts
import { replacePlaceholders } from '@streetsidesoftware/placeholders';

replacePlaceholders('{@ name @} v{@ pkg.version @}', { name: 'tool', pkg: { version: '1.2.3' } });
// "tool v1.2.3"
```

A dotted name walks the object: `pkg.version` reads `values.pkg.version`. Only own properties are read, and a
string or number value is used. The spaces just inside the delimiters are optional, so `{@name@}` works too.

A name is one or more segments joined by `.`. A segment has letters, digits, `_` and `-`, and doesn't start with
`-`.

### A resolver

Pass a function instead of an object to look values up yourself. Return `undefined` to leave a placeholder as
written:

```ts
replacePlaceholders('Hello {@ USER @}', (name) => process.env[name]);
```

### Placeholders without a value

A placeholder without a value is left as written. Use `listPlaceholders` or `hasPlaceholders` to find what is
left, for example to fail when a template uses a name you didn't pass:

```ts
import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';

const text = replacePlaceholders('{@ name @} {@ title @}', { name: 'tool' });
listPlaceholders(text);
// [{ name: 'title', start: 5, end: 16 }]
```

The offsets point into the text; `end` is exclusive. A value that itself contains `{@ … @}` is listed too, so
to check a template rather than its result, list the template's placeholders before replacing them.

### Delimiters

Choose other delimiters to keep a template valid for the file type it's in. The name rules stay the same:

```ts
replacePlaceholders('const name = __name__;', { name: '"tool"' }, { open: '__', close: '__' });
// 'const name = "tool";'
```

Every function takes the same `{ open, close }` options. The defaults are `{@` and `@}`.

## API

- `replacePlaceholders(text, values, options?)`: replace each placeholder that has a value.
- `listPlaceholders(text, options?)`: every placeholder in `text`, as `{ name, start, end }`, in order.
- `hasPlaceholders(text, options?)`: whether `text` has any placeholders.
- `isValidPlaceholderName(name)`: whether `name` follows the name rules.

## License

MIT

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<!--- @@inject-end: ../../static/footer.md --->
