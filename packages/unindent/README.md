# @streetsidesoftware/unindent

Remove the common indentation from multi-line strings and template literals, so text can be indented to match
the code around it.

## Install

```sh
npm install @streetsidesoftware/unindent
```

## Usage

```ts
import { unindent } from '@streetsidesoftware/unindent';

function usage(): string {
  return unindent`
    Usage: tool [options]

    Options:
      -h, --help  Show help.
  `;
}
// "\nUsage: tool [options]\n\nOptions:\n  -h, --help  Show help.\n"
```

Call `unindent` on a plain string too:

```ts
unindent('    a\n      b'); // "a\n  b"
```

### Multi-line values

When a value inserted with `${}` spans several lines, each line after the first gets the leading whitespace of
the template line it is inserted on. The value keeps its shape in the result:

```ts
const items = 'apple\nbanana';

unindent`
  fruit:
    ${items}
`;
// "\nfruit:\n  apple\n  banana\n"
```

The padding is the template line's leading whitespace, tabs included, not the column of the `${}`.

### Trimming the first and last lines

Use `createUnindent` to get an `unindent` that also drops the newline after the opening backtick and the
whitespace-only line before the closing one:

```ts
import { createUnindent } from '@streetsidesoftware/unindent';

const u = createUnindent({ trimFirstNewline: true, trimLastLine: true });

u`
  Usage: tool [options]
`;
// "Usage: tool [options]"
```

| Option             | Default | Effect                                                                      |
| ------------------ | ------- | --------------------------------------------------------------------------- |
| `trimFirstNewline` | `false` | Drop one leading newline.                                                   |
| `trimLastLine`     | `false` | Drop the last line, with the newline before it, when it is whitespace-only. |

### `indent`

Use `indent` to add padding to every line of a string except the first. An optional third argument pads the
first line:

```ts
import { indent } from '@streetsidesoftware/unindent';

indent('a\nb\nc', '  '); // "a\n  b\n  c"
indent('a\nb', '  ', '- '); // "- a\n  b"
```

## Behavior details

- **Leading and trailing newlines are kept.** Use [`createUnindent`](#trimming-the-first-and-last-lines) to drop
  them, or start the template with ``unindent`\`` (a line continuation) to leave out the first newline.
- **Blank and whitespace-only lines are ignored** when finding the common indentation. A whitespace-only line
  longer than that indentation keeps the extra whitespace.
- **Indentation is counted in characters.** A tab and a space each count as one, and mixed indentation is not
  normalized.
- **Line endings pass through.** Lines are split on `\n`, so a `\r` stays at the end of its line.
- **Escape sequences are processed.** A `\t` or `\n` in the template becomes a tab or a newline before the
  indentation is removed.
- **Values are converted with `String()`** semantics, as in a normal template literal.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

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
