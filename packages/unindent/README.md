# @streetsidesoftware/unindent

Remove the common indentation from multi-line strings and template literals, so text can be indented to match
the code around it.

## Install

```sh
npm install @streetsidesoftware/unindent
```

<!--- @@inject: examples/help-text/README.md --->

## Usage

Write the template indented to match the code around it. The common indentation is removed, and the lines keep their
indentation relative to each other.

```ts
import { unindent } from '@streetsidesoftware/unindent';

const HELP = unindent`\
  Usage: tool [options] <file>

  Options:
    -h, --help     Show help.
    -o, --out DIR  Write the result to DIR.
`;

process.stdout.write(HELP);
```

```text
Usage: tool [options] <file>

Options:
  -h, --help     Show help.
  -o, --out DIR  Write the result to DIR.
```

The `\` after the opening backtick is a line continuation, so the text starts on the template's first line. Without it,
the newline after the backtick is kept. To drop it every time, see
[Trimming the first and last lines](#trimming-the-first-and-last-lines).

<!--- @@inject-end: examples/help-text/README.md --->

<!--- @@inject: examples/plain-string/README.md --->

### Plain strings

Call `unindent` on a string too, such as lines copied out of indented code:

```ts
import { unindent } from '@streetsidesoftware/unindent';

// Lines copied out of an indented function.
const snippet = '    if (ok) {\n      run();\n    }';

console.log(unindent(snippet));
```

```text
if (ok) {
  run();
}
```

<!--- @@inject-end: examples/plain-string/README.md --->

<!--- @@inject: examples/multi-line-values/README.md --->

### Multi-line values

When a value inserted with `${}` spans several lines, each line after the first gets the leading whitespace of the
template line it is inserted on. The value keeps its shape in the result:

```ts
import { unindent } from '@streetsidesoftware/unindent';

const steps = ['pnpm install', 'pnpm test'].join('\n');

const workflow = unindent`\
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - run: |
            ${steps}
`;

process.stdout.write(workflow);
```

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pnpm install
          pnpm test
```

The padding is the template line's leading whitespace, tabs included, not the column of the `${}`. An empty line in the
value stays empty, and the rest of the value is kept as given: its own indentation, a trailing newline and its line
endings.

<!--- @@inject-end: examples/multi-line-values/README.md --->

<!--- @@inject: examples/trim-first-and-last-lines/README.md --->

### Trimming the first and last lines

Use `createUnindent` to get an `unindent` that also drops the newline after the opening backtick and the
whitespace-only line before the closing one. An error message needs both, so it has no blank line before or after it:

```ts
import {
  createUnindent,
  unindent,
} from '@streetsidesoftware/unindent';

const trimmedUnindent = createUnindent({
  trimFirstNewline: true,
  trimLastLine: true,
});

const untrimmed = unindent`
  Could not read config.json.
  Run tool init to create one.
`;

const trimmed = trimmedUnindent`
  Could not read config.json.
  Run tool init to create one.
`;

console.log(JSON.stringify(untrimmed));
console.log(JSON.stringify(trimmed));
```

```text
"\nCould not read config.json.\nRun tool init to create one.\n"
"Could not read config.json.\nRun tool init to create one."
```

| Option             | Default | Effect                                                                      |
| ------------------ | ------- | --------------------------------------------------------------------------- |
| `trimFirstNewline` | `false` | Drop one leading newline.                                                   |
| `trimLastLine`     | `false` | Drop the last line, with the newline before it, when it is whitespace-only. |

<!--- @@inject-end: examples/trim-first-and-last-lines/README.md --->

<!--- @@inject: examples/indent/README.md --->

### `indent`

Use `indent` to add padding to every line of a string except the first, such as a multi-line entry in a list. An empty
line stays empty. An optional third argument pads the first line:

```ts
import { indent } from '@streetsidesoftware/unindent';

const changes = [
  'Fix a crash on empty input.\nIt now returns an empty string.',
  'Add `indent`.',
];

const items = changes.map((change) => indent(change, '  ', '- '));

console.log(items.join('\n'));
```

```markdown
- Fix a crash on empty input.
  It now returns an empty string.
- Add `indent`.
```

<!--- @@inject-end: examples/indent/README.md --->

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
