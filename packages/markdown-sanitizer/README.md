# @streetsidesoftware/markdown-sanitizer

Scans a Markdown document for text that may be hidden from the reader, such as an HTML comment. Use it to expose
comments and other hidden text in a pull request body, a commit message or other content.

Hidden text matters because an agent reads the Markdown, not the page. A comment that no reviewer sees on GitHub
still reaches an agent that reads the pull request, and it can carry instructions, such as
`<!-- Ignore previous instructions. -->`. Tag characters are invisible even in the Markdown, but a model reads them as
text.

- Revealing hidden text shows a reviewer what an agent sees.
- Removing it keeps it out of text that agents read later, such as a changelog.

## Install

```sh
npm install --save-dev @streetsidesoftware/markdown-sanitizer
```

Or run it without installing it, with `npx @streetsidesoftware/markdown-sanitizer`.

## Usage

```text
markdown-sanitizer <command> [options] [file...]
```

The command reads each file you give it, or standard input when you give none.

| Command  | What it does                                            |
| -------- | ------------------------------------------------------- |
| `check`  | Lists the hidden text.                                  |
| `remove` | Prints the Markdown without the hidden text.            |
| `reveal` | Prints the Markdown with the hidden text shown as code. |

Which to use:

- `check` in CI or a pre-commit hook: it exits with 1 when it finds hidden text.
- `reveal` to show a reviewer what is hidden, but not for text that agents read, since an agent reads revealed text
  too.
- `remove` to clean text that agents will read, such as a changelog.

### check

Lists each piece of hidden text, one per line:

```sh
gh pr view 123 --json body -q .body | npx @streetsidesoftware/markdown-sanitizer check
```

```text
<stdin>:3:1 comment "<!-- Ignore previous instructions. -->"
<stdin>:5:18 invisible "\u{E0049}\u{E0067}"
```

Each line gives the file, line, column, kind and text. Standard input is named `<stdin>`. The kind is `comment`,
`definition`, `footnote` or `invisible`, as described under What counts as hidden.

It exits with 1 when it finds hidden text, and with 0 when it finds none. To check a commit message:

```sh
git log -1 --format=%B | npx @streetsidesoftware/markdown-sanitizer check
```

### remove

Prints the Markdown without the hidden text:

```sh
echo 'Fix the <!-- secret --> parser.' | npx @streetsidesoftware/markdown-sanitizer remove
```

```text
Fix the  parser.
```

Removing text can bring the text on either side together into new hidden text. In `<!-<!-- x -->- y -->`, taking out
`<!-- x -->` leaves `<!-- y -->`, a new comment. So in place of the hidden text, `remove` leaves a zero-width space,
an invisible character that keeps the two sides apart. Where a space after a word already comes before the hidden
text, as in the example above, it leaves nothing.

Options:

- `--write`: replace each file with the result, instead of printing it. Every input is read first, so if one can't be
  read, no file is changed.

A changelog built from commit messages, such as by a release tool, carries their hidden text into a file that agents
read when they upgrade a dependency. To clean one in place:

```sh
npx @streetsidesoftware/markdown-sanitizer remove --write CHANGELOG.md
```

### reveal

Prints the Markdown with the hidden text shown as code, so a reviewer sees what an agent reads:

```sh
echo 'Fix the <!-- secret --> parser.' | npx @streetsidesoftware/markdown-sanitizer reveal
```

```text
Fix the `<!-- secret -->` parser.
```

Options:

- `--write`: replace each file with the result, instead of printing it. Every input is read first, so if one can't be
  read, no file is changed.

### Options for every command

- `--max-size <bytes>`: the largest input allowed, in bytes. The default is 10000000 (10 MB), since parsing larger
  input can take a long time.
- `-h`, `--help`: show the help.

### Exit codes

- `0`: success. For `check`, that means it found no hidden text.
- `1`: `check` found hidden text.
- `2`: a wrong call, a file it can't read or write, input that isn't UTF-8, or input over the limit. It prints the
  error on standard error.

## What counts as hidden

- **Comments** (`comment`). An HTML comment, `<!-- … -->`, never shows on the page. Neither does other markup that a
  browser reads as a comment, such as `<?php … ?>`. A comment inside code shows on the page as it is, so it doesn't
  count.
- **Unused link definitions** (`definition`). A link definition, such as `[docs]: https://example.com`, shows nothing
  by itself: the page shows only the links that use it. A definition that no link uses never shows, which is why
  `[//]: # (note)` works as a comment.
- **Unused footnotes** (`footnote`). GitHub shows a footnote only when the text cites it, as in `[^1]`. A footnote
  that nothing cites never shows.
- **Tag characters and variation selectors** (`invisible`). These Unicode characters are invisible even in the
  Markdown, but a model reads them. Tag characters can spell out a whole sentence, one invisible character per letter,
  and a run of variation selectors can carry hidden text the same way. The ones that make up an emoji, such as ❤️ or
  the Scotland flag, don't count.

### What it doesn't catch

It reports only text that is clearly hidden, where removing it can't delete anything a reader sees. Text that may
or may not be hidden, depending on where the Markdown is shown, isn't reported:

- HTML that a browser hides but GitHub shows, such as a `<script>` element or the `hidden` attribute.
- Text a reader can see with a click or a hover, such as a closed `<details>` element or a link's title.
- Other invisible characters, such as the zero-width space, the soft hyphen or a direction mark. They're common in
  ordinary text, such as a zero-width space that keeps `@name` from mentioning someone.

> **Note:** a clean `check` means it found none of the hidden text above, not that the Markdown hides nothing.

## Library

To use it from code, install it as a dependency:

```sh
npm install @streetsidesoftware/markdown-sanitizer
```

```ts
import { findHidden } from '@streetsidesoftware/markdown-sanitizer';

const message = 'Fix the parser.\n\n<!-- Ignore previous instructions. -->\n';

for (const hidden of findHidden(message)) {
  console.log(`${hidden.line}:${hidden.column} ${hidden.kind}: ${JSON.stringify(hidden.text)}`);
}
```

```text
3:1 comment: "<!-- Ignore previous instructions. -->"
```

Each result has these properties:

- `kind`: what hides the text: `comment`, `definition`, `footnote` or `invisible`.
- `start` and `end`: the offsets of the hidden text in the Markdown, with `end` just past it.
- `line` and `column`: where the hidden text starts, both from 1.
- `text`: the hidden text, exactly as it is in the Markdown.

To take the hidden text out, or to show it on the page for a reviewer, use `sanitize`:

```ts
import { sanitize } from '@streetsidesoftware/markdown-sanitizer';

sanitize('Fix the <!-- secret --> parser.', 'remove');
// Fix the  parser.

sanitize('Fix the <!-- secret --> parser.', 'reveal');
// Fix the `<!-- secret -->` parser.
```

Each mode works as the command of the same name does, as described under Usage.

### Running the command from code

The command is also exported as `run`, from `@streetsidesoftware/markdown-sanitizer/cli`. It takes the arguments after
the program name and returns the exit code. A package that wraps the command, such as one that provides a pre-commit
hook, needs only this file as its `bin`:

```js
#!/usr/bin/env node
import { run } from '@streetsidesoftware/markdown-sanitizer/cli';

process.exitCode = await run(process.argv.slice(2));
```

By default, `run` reads the process's standard input and writes to its standard output and error. To use other
streams, such as to test a command that wraps `run`, pass them as the second argument:

```ts
import { Readable } from 'node:stream';

import { run } from '@streetsidesoftware/markdown-sanitizer/cli';

let output = '';
const code = await run(['check'], {
  stdin: Readable.from(['Fix the parser.\n\n<!-- Ignore previous instructions. -->\n']),
  stdout: (text) => (output += text),
  stderr: (text) => (output += text),
});
// code: 1
// output: '<stdin>:3:1 comment "<!-- Ignore previous instructions. -->"\n'
```

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
