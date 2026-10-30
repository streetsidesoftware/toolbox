## Build in code

Each builder returns an element. Put elements together with `document`, and render the page with `toString()`. A
document ends with a newline; other elements don't, so they can be joined. Strings are text, shown as written.

<!--- @@inject: text/README.md --->

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

<!--- @@inject-end: text/README.md --->

<!--- @@inject: headings/README.md --->

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

<!--- @@inject-end: headings/README.md --->

<!--- @@inject: inline-formatting/README.md --->

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

<!--- @@inject-end: inline-formatting/README.md --->

<!--- @@inject: lists/README.md --->

### Lists

Give `list` an array with one entry per item. An entry can be an array of pieces, and a `list` among them makes a
nested list.

For a numbered list, use `ol`, or `list` with `ordered: true`. Every item in the Markdown repeats the first number,
and the page counts up from it.

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

<!--- @@inject-end: lists/README.md --->

<!--- @@inject: code-blocks/README.md --->

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

<!--- @@inject-end: code-blocks/README.md --->

<!--- @@inject: line-breaks-and-comments/README.md --->

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

<!--- @@inject-end: line-breaks-and-comments/README.md --->

<!--- @@inject: tables/README.md --->

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

<!--- @@inject-end: tables/README.md --->

<!--- @@inject: html-tables/README.md --->

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

<!--- @@inject-end: html-tables/README.md --->

<!--- @@inject: details-and-definition-lists/README.md --->

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

<!--- @@inject-end: details-and-definition-lists/README.md --->
