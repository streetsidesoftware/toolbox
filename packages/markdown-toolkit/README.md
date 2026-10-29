# @streetsidesoftware/markdown-toolkit

A toolkit for generating Markdown: builders, templates and placeholders. Compose links, lists, headings and code,
or substitute values into a Markdown template, then render the result with `toString()`.

## Install

```sh
npm install @streetsidesoftware/markdown-toolkit
```

<!--- @@inject: examples/opening-template/README.md --->

## With a template

Write the Markdown you want, mark the gaps with `{@ name @}`, and substitute values for them.
[`unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent), from `@streetsidesoftware/unindent`, removes
the indentation.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const name = 'cspell';

const doc = md.templateDocument(
  markdown`
    # {@ name @}

    Install with \`npm i {@ name @}\`.
  `,
  { name },
);

process.stdout.write(doc.toString());
```

```markdown
# cspell

Install with `npm i cspell`.
```

<!--- @@inject-end: examples/opening-template/README.md --->

<!--- @@inject: examples/opening-builders/README.md --->

## Or build it in code

The same page, built in code. Each builder returns a Markdown element. Put them together with `document`, and
render the file with `toString()`.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const name = 'cspell';

const doc = md.document(
  md.heading(1, name),
  md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'),
);

process.stdout.write(doc.toString());
```

```markdown
# cspell

Install with `npm i cspell`.
```

<!--- @@inject-end: examples/opening-builders/README.md --->

## Features

- **Builders.** Compose a document from headings, paragraphs, lists, tables, links and code, as elements rather
  than strings.
- **Templates.** Write the Markdown you want, mark the gaps with `{@ name @}`, and substitute strings or
  elements for them.
- **Placeholders.** Leave a placeholder for a later step to substitute, or hand it to a tool such as inject-markdown.
- **Fits existing documents.** Detect the style a document already uses, such as `*` or `-` bullets, and render in
  that style.
- **Built on remark.** Parsing and rendering use [unified](https://unifiedjs.com) and
  [remark](https://github.com/remarkjs/remark) with GitHub Flavored Markdown, not hand-rolled string rules.

<!--- @@inject: examples/generate-a-file/README.md --->

## Generate a Markdown file from data

A script usually has its data in arrays and objects. Map each item to an element, here a link in a list, and put
the elements together with `document`.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const links = [
  { title: 'Docs', url: 'https://cspell.org' },
  { title: 'Source', url: 'https://github.com/streetsidesoftware/cspell' },
];

const doc = md.document(
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.list(links.map(({ title, url }) => md.link(title, url))),
  md.codeBlock('npm install -D cspell', 'sh'),
);

process.stdout.write(doc.toString());
```

````markdown
## Using `cspell`

- [Docs](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm install -D cspell
```
````

<!--- @@inject-end: examples/generate-a-file/README.md --->

<!--- @@inject: examples/make-a-table/README.md --->

## Make a table from data

Give `table` the header and one array of cells per row. A cell holds inline content, such as text, inline code, links
and strong text. A
`lineBreak()` renders as `<br/>`, since a Markdown line break would end the row.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const commands = [
  { command: 'cSpell.addWordToDictionary', title: 'Add Words to Dictionary' },
  { command: 'cSpell.toggleEnableSpellChecker', title: 'Toggle Spell Checking', when: 'editorTextFocus' },
];

const doc = md.document(
  md.heading(2, 'Commands'),
  md.table(
    ['Command', 'Title'],
    commands.map((c) => [
      md.inlineCode(c.command),
      c.when ? [c.title, md.lineBreak(), md.strong('When:'), ' ', md.inlineCode(c.when)] : c.title,
    ]),
  ),
);

process.stdout.write(doc.toString());
```

```markdown
## Commands

| Command                           | Title                                                 |
| --------------------------------- | ----------------------------------------------------- |
| `cSpell.addWordToDictionary`      | Add Words to Dictionary                               |
| `cSpell.toggleEnableSpellChecker` | Toggle Spell Checking<br/>**When:** `editorTextFocus` |
```

A short row is padded with empty cells. To align a column, pass `{ align: [undefined, 'right'] }`, one entry per
column. An entry can also be written as in the table: `:---`, `:---:`, `---:` or `---`.

<!--- @@inject-end: examples/make-a-table/README.md --->

<!--- @@inject: examples/write-the-markdown/README.md --->

## Write the Markdown yourself, with data in it

A template is Markdown with `{@ name @}` placeholders. A string value is inserted as text, an element as Markdown,
and a placeholder on a line of its own can take blocks, such as a list. If a string is already Markdown, pass
`md.parse(text)`.

The template is indented to match the code, and `unindent` from [`@streetsidesoftware/unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) removes the indentation. Imported as
`markdown`, the tag also tells editors and Prettier that the text is Markdown, so it's highlighted and formatted as
Markdown.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const readme = md.template(
  markdown`
    ## {@ name @}

    Install with \`npm i {@ name @}\`, then see {@ docs @}.

    {@ features @}
  `,
  {
    name: '@cspell/dict-nl-nl',
    docs: md.link('the docs', 'https://github.com/streetsidesoftware/cspell-dicts/tree/main/dictionaries/nl_NL'),
    features: md.list(['Dutch words', ['Import ', md.inlineCode('@cspell/dict-nl-nl/cspell-ext.json'), ' in your cspell config']]),
  },
);

console.log(readme.toString());
```

```markdown
## @cspell/dict-nl-nl

Install with `npm i @cspell/dict-nl-nl`, then see [the docs](https://github.com/streetsidesoftware/cspell-dicts/tree/main/dictionaries/nl_NL).

- Dutch words
- Import `@cspell/dict-nl-nl/cspell-ext.json` in your cspell config
```

A name may be dotted, such as `{@ engines.node @}`, and is looked up in nested objects.

- `template` returns inline content when the result is one paragraph, and blocks otherwise.
- `blockTemplate` always returns blocks.
- `inlineTemplate` requires one paragraph, for use inside a line.

<!--- @@inject-end: examples/write-the-markdown/README.md --->

<!--- @@inject: examples/build-in-steps/README.md --->

## Build a page in steps

A page can be built by several steps, each substituting what it knows. `substitutePlaceholders` takes the result of
one step and substitutes more of its placeholders. A placeholder that no step has a value for is kept as written, so a
later step, or a tool such as inject-markdown, can substitute it.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

// The layout, with the title this step knows.
const layout = md.template(
  markdown`
    # {@ title @}

    {@ summary @}

    ## Results

    {@ results @}

    Last run: {@ date @}
  `,
  { title: 'Spell check report' },
);

// Each later step substitutes what it knows, and passes the rest on.
const summarized = md.substitutePlaceholders(layout, { summary: md.paragraph('Checked 2 files.') });
const report = md.substitutePlaceholders(summarized, {
  results: md.list(['README.md: no issues', 'docs/guide.md: 1 unknown word']),
});

// `{@ date @}` is left for a later step, such as inject-markdown.
console.log(report.toString());
```

```markdown
# Spell check report

Checked 2 files.

## Results

- README.md: no issues
- docs/guide.md: 1 unknown word

Last run: {@ date @}
```

<!--- @@inject-end: examples/build-in-steps/README.md --->

<!--- @@inject: examples/add-frontmatter/README.md --->

## Add frontmatter to a generated page

Sites such as Docusaurus read a page's settings from YAML frontmatter at its start. Put `frontmatter` first in a
document. Its text is inserted as is, between `---` lines, so making it valid YAML is up to you.

The YAML here is written with an `unindent` from [`@streetsidesoftware/unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) that also drops the newline after the opening backtick, so the
frontmatter doesn't start with a blank line.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { createUnindent } from '@streetsidesoftware/unindent';

const yaml = createUnindent({ trimFirstNewline: true });

const title = 'Code Spell Checker';

const page = md.document(
  md.frontmatter(yaml`
    # AUTO-GENERATED: edit the script, not this file.
    title: ${title}
    id: code-spell-checker
  `),
  md.heading(1, title),
  md.paragraph('Settings that control the behavior of the spell checker.'),
);

process.stdout.write(page.toString());
```

```markdown
---
# AUTO-GENERATED: edit the script, not this file.
title: Code Spell Checker
id: code-spell-checker
---

# Code Spell Checker

Settings that control the behavior of the spell checker.
```

<!--- @@inject-end: examples/add-frontmatter/README.md --->

<!--- @@inject: examples/page-from-a-template-file/README.md --->

## Generate a page from a template file

A template for a whole page, such as `template.md`, can start with frontmatter:

```markdown
---
title: {@ title @}
description: >-
  {@ description @}
---

# {@ title @}

{@ description @}
```

`templateDocument` reads it as a whole page, keeps its frontmatter, and substitutes the placeholders in both. The
frontmatter is YAML, not Markdown, so a value there is inserted as is. Each line of a value after the first gets the
indentation of the placeholder's line, so a multi-line value stays inside a YAML block such as `>-`.

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.templateDocument(fs.readFileSync('template.md', 'utf8'), {
  title: 'CSpell',
  description: 'Settings for the cspell command line tool.\nThey apply to every file it checks.',
});

process.stdout.write(page.toString());
```

```markdown
---
title: CSpell
description: >-
  Settings for the cspell command line tool.
  They apply to every file it checks.
---

# CSpell

Settings for the cspell command line tool.
They apply to every file it checks.
```

`parseDocument` reads a whole page without substituting anything. `template` and `parse` read a part of a page instead,
where a leading `---` is a horizontal rule.

<!--- @@inject-end: examples/page-from-a-template-file/README.md --->

<!--- @@inject: examples/match-a-style/README.md --->

## Match the style of the file you're updating

By default, lists use `-` bullets and emphasis uses `_`. To fit into a file that already exists, detect the style
it uses and render in it:

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// The file being updated uses `*` bullets and `*` emphasis.
const existing = '# Fruit\n\n* Apples\n* *Pears*\n';

const section = md.document(md.list(['Plums', md.emphasis('Cherries')])).withStyle(md.detectStyle(existing));

process.stdout.write(section.toString());
```

```markdown
* Plums
* *Cherries*
```

A template or parsed text keeps the style of its own text, but spacing and table padding may change.

<!--- @@inject-end: examples/match-a-style/README.md --->

## What's included

- Inline: `text` (`inlineText`), `inlineCode`, `link`, `strong`, `emphasis`, `strikethrough`, `lineBreak`, `br`,
  `comment`, `placeholder`
- Blocks: `heading`, `paragraph`, `blockText`, `list`, `listItem`, `codeBlock`, `horizontalRule` (`hr`),
  `table`, `blockPlaceholder`, `toBlock`
- HTML blocks: `details` for a collapsible `<details>` section, and `definitionList` (`dl`) for a `<dl>` definition list
- A whole document: `document`, `frontmatter`, `parseDocument`, `templateDocument`
- Templates and placeholders: `template` (`templateFragment`), `blockTemplate`, `inlineTemplate`, `parse`
  (`parseFragment`), `substitutePlaceholders`
- Style: `detectStyle`, and `withStyle` on a document
- Checks: `isMarkdown`, which tells whether a value was made by this package

Every element renders with `toString()`. A document ends with a newline; other elements don't, so they can be joined.

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
