# @streetsidesoftware/markdown-toolkit

A toolkit for generating GitHub Flavored Markdown. Build a page from elements in code, or write it as a template and
substitute values for its placeholders. Either way, render it with `toString()`.

## Install

```sh
npm install @streetsidesoftware/markdown-toolkit
```

<!--- @@inject: examples/opening-template/README.md --->

## With a template

Write the page as Markdown, mark each gap with a `{@ name @}` placeholder, and substitute values for them. A value
can be a string or an element, such as a link or a list.
[`unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) removes the template's indentation.
Imported as `markdown`, it also gets editors to highlight the template as Markdown.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl' },
  { language: 'French', name: '@cspell/dict-fr-fr' },
  { language: 'German', name: '@cspell/dict-de-de' },
];

const page = md.templateDocument(
  markdown`
    # Dictionaries

    Language dictionaries for {@ cspell @}.

    {@ dictionaries @}
  `,
  {
    cspell: md.link('cspell', 'https://cspell.org'),
    dictionaries: md.list(
      dictionaries.map((d) => md.link(d.language, npmUrl(d.name))),
    ),
  },
);

console.log(page.toString());

function npmUrl(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}
```

```markdown
# Dictionaries

Language dictionaries for [cspell](https://cspell.org).

- [Dutch](https://www.npmjs.com/package/@cspell/dict-nl-nl)
- [French](https://www.npmjs.com/package/@cspell/dict-fr-fr)
- [German](https://www.npmjs.com/package/@cspell/dict-de-de)
```

<!--- @@inject-end: examples/opening-template/README.md --->

<!--- @@inject: examples/opening-builders/README.md --->

## Or build it in code

The same page, built from elements. Each builder returns an element, and `document` puts them together into a page.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl' },
  { language: 'French', name: '@cspell/dict-fr-fr' },
  { language: 'German', name: '@cspell/dict-de-de' },
];

const page = md.document(
  md.heading(1, 'Dictionaries'),
  md.p(
    'Language dictionaries for ',
    md.link('cspell', 'https://cspell.org'),
    '.',
  ),
  md.list(
    dictionaries.map((d) => md.link(d.language, npmUrl(d.name))),
  ),
);

console.log(page.toString());

function npmUrl(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}
```

```markdown
# Dictionaries

Language dictionaries for [cspell](https://cspell.org).

- [Dutch](https://www.npmjs.com/package/@cspell/dict-nl-nl)
- [French](https://www.npmjs.com/package/@cspell/dict-fr-fr)
- [German](https://www.npmjs.com/package/@cspell/dict-de-de)
```

<!--- @@inject-end: examples/opening-builders/README.md --->

<!--- @@inject: examples/build-in-code/README.md --->

## Build in code

Each builder returns an element. Put elements together with `document`, and render the page with `toString()`. A
document ends with a newline; other elements don't, so they can be joined. Strings are text, shown as written.

### Text and paragraphs

Pass one or more pieces to `p` (`paragraph`) to make a paragraph. The pieces are joined as given, with no spaces
added. To turn plain text into paragraphs, use `blockText`: each blank line starts a new paragraph.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const summary = 'A spell checker for code.';
const notes = [
  'It checks comments, strings and Markdown.',
  '',
  'It runs in CI and in the editor.',
].join('\n');

const page = md.document(
  md.p(summary, ' It works offline.'),
  md.blockText(notes),
);

console.log(page.toString());
```

```markdown
A spell checker for code. It works offline.

It checks comments, strings and Markdown.

It runs in CI and in the editor.
```

### Headings

Give `heading` a depth from 1 to 6 and its text. The text can be several pieces, such as text and inline code. To
separate sections with a line, use `horizontalRule()` (`hr()`).

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.heading(1, 'cspell'),
  md.p('A spell checker for code.'),
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.p('Run it on every file in the project.'),
);

console.log(page.toString());
```

```markdown
# cspell

A spell checker for code.

## Using `cspell`

Run it on every file in the project.
```

### Links and inline formatting

These go inside a line: `link`, `inlineCode`, `strong`, `emphasis` and `strikethrough`. Each one except
`inlineCode` takes inline content, so they nest, as in a link with strong text.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p(
    'Run ',
    md.inlineCode('npx cspell .'),
    ' to check ',
    md.strong('every'),
    ' file.',
  ),
  md.p(
    'See ',
    md.link('the docs', 'https://cspell.org'),
    ' for options.',
  ),
);

console.log(page.toString());
```

```markdown
Run `npx cspell .` to check **every** file.

See [the docs](https://cspell.org) for options.
```

### Lists

Give `list` an array with one entry per item. An entry can be an array of pieces, and a `list` among them makes a
nested list.

For a numbered list, use `ol`, or `list` with `ordered: true`. Every item in the Markdown repeats the first number,
and the page counts up from it.

For a checkbox, end a `listItem` (or `li`) with `{ checked: true }` or `{ checked: false }`. Or use `taskListItem`,
whose box is empty unless its options hold `checked: true`.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = {
  Languages: ['Dutch', 'French', 'German'],
  Programming: ['Python', 'Rust', 'TypeScript'],
};

const page = md.document(
  md.list(
    Object.entries(dictionaries).map(([group, names]) => [
      group,
      md.list(names),
    ]),
  ),
  md.p('To add one:'),
  md.ol(['Install the dictionary.', 'Add it to the config.']),
);

console.log(page.toString());
```

```markdown
- Languages
  - Dutch
  - French
  - German
- Programming
  - Python
  - Rust
  - TypeScript

To add one:

1. Install the dictionary.
1. Add it to the config.
```

### Code blocks

Give `codeBlock` the code and, optionally, its language. The code goes in as written.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p('Install cspell as a dev dependency:'),
  md.codeBlock('npm install --save-dev cspell', 'sh'),
);

console.log(page.toString());
```

````markdown
Install cspell as a dev dependency:

```sh
npm install --save-dev cspell
```
````

### Line breaks and comments

A `lineBreak()` starts a new line in the same paragraph. For HTML or MDX, `br()` always writes `<br/>`. A
`comment` is an HTML comment, which isn't displayed, such as a `cspell:ignore` line for a spell checker.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.comment('cspell:ignore gezellig'),
  md.p('Knows Dutch words such as ', md.emphasis('gezellig'), '.'),
  md.p('Maintained by', md.lineBreak(), 'Street Side Software'),
);

console.log(page.toString());
```

```markdown
<!-- cspell:ignore gezellig -->

Knows Dutch words such as _gezellig_.

Maintained by\
Street Side Software
```

### Tables

Give `table` the header and one array of cells per row. A cell holds inline content, such as text, inline code and
links. To align a column, pass `{ align: ['left', 'right'] }`, one entry per column.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl', locale: 'nl' },
  { language: 'French', name: '@cspell/dict-fr-fr', locale: 'fr' },
  { language: 'German', name: '@cspell/dict-de-de', locale: 'de' },
];

const page = md.document(
  md.table(
    ['Language', 'Package', 'Locale'],
    dictionaries.map((d) => [
      d.language,
      md.inlineCode(d.name),
      d.locale,
    ]),
  ),
);

console.log(page.toString());
```

```markdown
| Language | Package              | Locale |
| -------- | -------------------- | ------ |
| Dutch    | `@cspell/dict-nl-nl` | nl     |
| French   | `@cspell/dict-fr-fr` | fr     |
| German   | `@cspell/dict-de-de` | de     |
```

### HTML tables

When a cell needs more than one line, such as a list or a code block, use `htmlTable`. It takes the same header,
rows and options as `table`, and a cell can hold any content. GitHub renders the HTML table it writes.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const options = [
  { name: '--words', description: 'Words to accept as correct.' },
  {
    name: '--languages',
    description: [
      'The languages to check:',
      md.list(['en for English', 'nl for Dutch']),
    ],
  },
];

const page = md.document(
  md.htmlTable(
    ['Option', 'Description'],
    options.map((o) => [md.inlineCode(o.name), o.description]),
  ),
);

console.log(page.toString());
```

```markdown
<table>
<thead>
<tr>
<th>Option</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`--words`

</td>
<td>Words to accept as correct.</td>
</tr>
<tr>
<td>

`--languages`

</td>
<td>

The languages to check:

- en for English
- nl for Dutch

</td>
</tr>
</tbody>
</table>
```

### Details and definition lists

These are HTML blocks, which GitHub renders. Give `details` a summary and the content it hides. Give
`definitionList` (`dl`) one `[term, definition]` pair per entry.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.details(
    'Supported file types',
    md.list(['Markdown', 'Python', 'TypeScript']),
  ),
  md.dl([
    ['language', 'The languages to check, such as en or nl.'],
    ['words', 'Words to accept as correct.'],
  ]),
);

console.log(page.toString());
```

```markdown
<details>
<summary>Supported file types</summary>

- Markdown
- Python
- TypeScript

</details>

<dl>

<dt>language</dt>
<dd>

The languages to check, such as en or nl.

</dd>

<dt>words</dt>
<dd>

Words to accept as correct.

</dd>

</dl>
```

<!--- @@inject-end: examples/build-in-code/README.md --->

<!--- @@inject: examples/templates/README.md --->

## Templates

A template is Markdown with `{@ name @}` placeholders. It suits a page that is mostly fixed text, with data in a few
places.

### Placeholders

Each `{@ name @}` takes the value of the same name. A string goes in as text, and an element as Markdown. A
placeholder on a line of its own also takes blocks, such as a list or a table. A dotted name, such as
`{@ pkg.name @}`, looks up a nested object, and a placeholder works inside code too.

Use `inlineTemplate` for a template that goes inside a line, and `blockTemplate` for one that must be blocks.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const pkg = {
  name: '@cspell/dict-nl-nl',
  description: 'Dutch dictionary for cspell.',
};

const section = md.template(
  markdown`
    ## {@ pkg.name @}

    {@ pkg.description @}

    Install with \`npm i -D {@ pkg.name @}\`.
  `,
  { pkg },
);

console.log(section.toString());
```

```markdown
## @cspell/dict-nl-nl

Dutch dictionary for cspell.

Install with `npm i -D @cspell/dict-nl-nl`.
```

### Markdown from elsewhere

A string is always text. For a string that is already Markdown, such as a description from another file, pass
`parse(text)` instead. Like a template, it gives inline content or blocks, and `toBlock` makes either fit where
only blocks can go.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// From the dictionary's own docs, already written as Markdown.
const about =
  'Adds **Dutch** words. See [cspell.org](https://cspell.org).';

const page = md.document(md.heading(2, 'About'), md.parse(about));

console.log(page.toString());
```

```markdown
## About

Adds **Dutch** words. See [cspell.org](https://cspell.org).
```

### Build a page in steps

Several steps can each substitute what they know. Pass the result of one step to `substitutePlaceholders` to
substitute more of its placeholders. A placeholder with no value yet is kept as written, so a later step, or a tool
such as [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), can substitute it. In code,
`placeholder(name)` leaves the same gap inside a line, and `blockPlaceholder(name)` on lines of its own.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

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

const summarized = md.substitutePlaceholders(layout, {
  summary: md.p('Checked 2 files.'),
});
const report = md.substitutePlaceholders(summarized, {
  results: md.list([
    'README.md: no issues',
    'docs/guide.md: 1 unknown word',
  ]),
});

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

<!--- @@inject-end: examples/templates/README.md --->

<!--- @@inject: examples/whole-pages/README.md --->

## Whole pages

A page for a site such as Docusaurus often starts with YAML frontmatter.

### Frontmatter

Put `frontmatter` first in a document. Its text is YAML and goes in as written, between `---` lines.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const title = 'Code Spell Checker';

const yaml = [
  '# Generated: edit the script, not this file.',
  `title: ${title}`,
  'sidebar_position: 1',
].join('\n');

const page = md.document(
  md.frontmatter(yaml),
  md.heading(1, title),
  md.p('Settings that control the behavior of the spell checker.'),
);

console.log(page.toString());
```

```markdown
---
# Generated: edit the script, not this file.
title: Code Spell Checker
sidebar_position: 1
---

# Code Spell Checker

Settings that control the behavior of the spell checker.
```

### Template files

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

Read it with `templateDocument`, which keeps the frontmatter and substitutes the placeholders in both parts. A value
in the frontmatter goes in as written, since it's YAML.

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.templateDocument(
  fs.readFileSync('template.md', 'utf8'),
  {
    title: 'CSpell',
    description: [
      'Settings for the cspell command line tool.',
      'They apply to every file it checks.',
    ].join('\n'),
  },
);

console.log(page.toString());
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

To read a whole page without substituting anything, use `parseDocument`.

<!--- @@inject-end: examples/whole-pages/README.md --->

<!--- @@inject: examples/match-a-style/README.md --->

## Match an existing file's style

Lists use `-` bullets and emphasis uses `_` by default. To add to a file that uses another style, detect its style
and render in it.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// The README being updated uses `*` bullets.
const existing = '# Dictionaries\n\n* Dutch\n* French\n';

const section = md
  .document(md.list(['German', 'Spanish']))
  .withStyle(md.detectStyle(existing));

console.log(section.toString());
```

```markdown
* German
* Spanish
```

<!--- @@inject-end: examples/match-a-style/README.md --->

<!--- @@inject: static/api-reference.md --->

## Functions

### Text

- `p(...content)` (also `paragraph`): Create a paragraph from one or more pieces, such as strings and links.
- `text(value)` (also `inlineText`): Create text that shows exactly as given, even if it contains Markdown or HTML.
- `blockText(value)`: Create paragraphs from plain text, starting a new one at each blank line.
- `parse(markdown)` (also `parseFragment`): Parse Markdown text so it can be added to a page with its formatting.
- `lineBreak()`: Start a new line without starting a new paragraph.
- `htmlEntity(value)`: Create a character written as an HTML reference, such as `&nbsp;` for a no-break space.
- `nbsp`: Holds a no-break space, written `&nbsp;`. The words on either side of it stay on one line.
- `ensp`: Holds a space as wide as the letter n, written `&ensp;`.
- `emsp`: Holds a space as wide as the letter m, written `&emsp;`.
- `thinsp`: Holds a thin space, written `&thinsp;`.
- `shy`: Holds a soft hyphen, written `&shy;`. A long word may break there, and shows a hyphen only when it does.
- `mdash`: Holds an em dash, written `&mdash;`.
- `ndash`: Holds an en dash, written `&ndash;`.
- `hellip`: Holds an ellipsis, written `&hellip;`.
- `copy`: Holds a copyright sign, written `&copy;`.
- `br()`: Start a new line with an HTML `<br/>` tag.
- `comment(text)`: Create an HTML comment, `<!-- text -->`, which the page doesn't show.

### Links and formatting

- `link(content, url)`: Create a link that shows `content` and goes to `url`.
- `strong(content)`: Create bold text.
- `emphasis(content)`: Create italic text.
- `strikethrough(content)`: Create text with a line through it.

### Headings and sections

- `heading(depth, content)`: Create a heading.
- `hr()` (also `horizontalRule`): Create a line across the page, to separate sections.
- `details(summary, ...content)`: Create a collapsible section: the reader sees `summary` and clicks it to show the content.

### Lists and tables

- `list(entries, options?)`: Create a bulleted or numbered list, one item per entry.
- `ol(entries, options?)`: Create a numbered list, one item per entry.
- `ul(entries)`: Create a bulleted list, one item per entry.
- `listItem(...content)` (also `li`): Create one list item from several pieces.
- `taskListItem(...content)`: Create one task list item: a list item with a checkbox.
- `table(header, rows, options?)`: Create a table with a header row, then one row per entry.
- `htmlTable(header, rows, options?)`: Create a table whose cells can hold anything, including lists and paragraphs.
- `dl(entries)` (also `definitionList`): Create a list of terms, each followed by its definition.

### Code

- `codeBlock(code, lang?)`: Create a block of code, shown exactly as given.
- `inlineCode(code)`: Create code within a line of text, shown exactly as given.

### Templates

- `template(markdown, values)` (also `templateFragment`): Create Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `inlineTemplate(markdown, values)`: Create a line of Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `blockTemplate(markdown, values)`: Create paragraphs and other blocks from a template by substituting values for its `{@ name @}` placeholders.
- `templateDocument(markdown, values)`: Create a whole Markdown file from a template by substituting values for its `{@ name @}` placeholders.
- `substitutePlaceholders(content, values)`: Substitute values for the `{@ name @}` placeholders in an existing element, such as a parsed file, or in plain text.
- `placeholder(name)`: Create a `{@ name @}` placeholder for a value to be substituted later.
- `blockPlaceholder(name)`: Create a `{@ name @}` placeholder on lines of its own, for a value to be substituted later.

### Documents

- `document(...content)`: Create a whole Markdown file from its parts, in order.
- `frontmatter(yaml)`: Create YAML frontmatter for the start of a file, between `---` lines.
- `detectStyle(markdown)`: Detect how existing Markdown is written, such as its bullet and emphasis markers.
- `parseDocument(markdown)`: Parse a whole Markdown file, frontmatter included.

### Elements

- `isMarkdown(value)`: Check whether a value is an element made by this library, such as a paragraph or a link.
- `toBlock(content)`: Put text, links and other pieces in a paragraph of their own.

<!--- @@inject-end: static/api-reference.md --->

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
