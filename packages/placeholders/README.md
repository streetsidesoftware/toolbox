# @streetsidesoftware/placeholders

Replace placeholders such as `{@ name @}` in a string with values, and find the ones that are left.

## Install

```sh
npm install @streetsidesoftware/placeholders
```

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

### Multi-line values

Each line of a value after the first gets the leading whitespace of the placeholder's line, so a multi-line value
stays where the template puts it:

```ts
replacePlaceholders('run: |\n  {@ script @}\n', { script: 'npm ci\nnpm test' });
// "run: |\n  npm ci\n  npm test\n"
```

The rest of the value is kept as given: its own indentation, a trailing newline and its line endings. An empty line
stays empty. To indent a line further, put the extra whitespace in the value:

```ts
replacePlaceholders('  - {@ item @}', { item: 'apple\n  red' });
// "  - apple\n    red"
```

Pass `{ autoIndent: false }` to insert values exactly as given.

### Placeholders without a value

A placeholder without a value is left as written. Use `listPlaceholders` or `hasPlaceholders` to find what is
left, for example to fail when a template uses a name you didn't pass:

```ts
import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';

const text = replacePlaceholders('{@ name @} {@ title @}', { name: 'tool' });
[...listPlaceholders(text)];
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

- `replacePlaceholders(text, values, options?)`: replace each placeholder that has a value. Besides `open` and `close`,
  `options` takes `autoIndent`.
- `listPlaceholders(text, options?)`: every placeholder in `text`, as `{ name, start, end }`, in order. It returns an
  iterable that finds them as it goes; spread it for an array.
- `hasPlaceholders(text, options?)`: whether `text` has any placeholders.
- `isValidPlaceholderName(name)`: whether `name` follows the name rules.

## Requirements

<!--- @@inject: ../../static/requirements.md#values-file=:package.json --->

Requires Node.js >=22.18.0. ESM only.

<!--- @@inject-end: ../../static/requirements.md#values-file=:package.json --->

## License

MIT

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

If our tools save you time, please consider supporting their development.

Please show your support through one of the following sites:

<p align="left">
  <a href="https://github.com/sponsors/streetsidesoftware" title="GitHub Sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/github-sponsor-dark.png" /><img alt="GitHub Sponsor" src="https://streetsidesoftware.com/img/sponsor/github-sponsor.png" width="180" /></picture></a> &nbsp; <a href="https://www.paypal.com/donate/?hosted_button_id=26LNBP2Q6MKCY" title="PayPal"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/paypal-dark.png" /><img alt="PayPal" src="https://streetsidesoftware.com/img/sponsor/paypal.png" width="180" /></picture></a> &nbsp; <a href="https://opencollective.com/cspell" title="Open Collective"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/open-collective-dark.png" /><img alt="Open Collective" src="https://streetsidesoftware.com/img/sponsor/open-collective.png" width="180" /></picture></a> &nbsp; <a href="https://streetsidesoftware.com/sponsor/" title="Street Side Software"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/cspell-dark.png" /><img alt="CSpell" src="https://streetsidesoftware.com/img/sponsor/cspell.png" width="180" /></picture></a>
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
