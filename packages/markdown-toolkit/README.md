# @streetsidesoftware/markdown-toolkit

A toolkit for generating Markdown: builders, templates and placeholders. Compose links, lists, headings and code,
or fill a Markdown template, then render the result with `toString()`.

## Install

```sh
npm install @streetsidesoftware/markdown-toolkit
```

## Why use it

- **Builders.** Compose a document from headings, paragraphs, lists, links and code, as values rather than
  strings.
- **Templates.** Write the Markdown you want, mark the gaps with `{@ name @}`, and fill them with strings or
  built values.
- **Placeholders.** Leave a gap unfilled and fill it in a later step, or hand it to a tool such as inject-markdown.
- **Fits existing documents.** Detect the style a document already uses, such as `*` or `-` bullets, and render in
  that style.
- **Text stays text.** A value is escaped for where it ends up, so a `*` or `[` in it doesn't turn into Markdown.
- **Built on remark.** Parsing and rendering use [unified](https://unifiedjs.com) and
  [remark](https://github.com/remarkjs/remark) with GitHub Flavored Markdown, not hand-rolled string rules.

## Build a document

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const doc = md.document(
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.list([
    md.link('Docs [beta]', 'https://cspell.org'),
    md.link('Source', 'https://github.com/streetsidesoftware/cspell'),
  ]),
  md.codeBlock('npm install -D cspell', 'sh'),
);
console.log(doc.toString());
```

````markdown
## Using `cspell`

- [Docs \[beta\]](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm install -D cspell
```
````

Each builder escapes its content for where it ends up, so the `]` in the link text doesn't end the link. The same
goes for text that only looks like Markdown:

```ts
md.paragraph('1. Use *any* [text] here').toString();
// 1\. Use \*any\* \[text] here
```

## Fill a template

A template is Markdown with `{@ name @}` placeholders. A string value is escaped, a built value is inserted as
Markdown, and a placeholder on a line of its own can take blocks, such as a list.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const readme = md.template(
  `## {@ name @}

Install with \`npm i {@ name @}\`, then see {@ docs @}.

{@ features @}
`,
  {
    name: 'my_package*',
    docs: md.link('the docs', 'https://example.com'),
    features: md.list(['Fast', ['Escapes ', md.inlineCode('*'), ' for you']]),
  },
);
console.log(readme.toString());
```

```markdown
## my_package\*

Install with `npm i my_package*`, then see [the docs](https://example.com).

- Fast
- Escapes `*` for you
```

The name is escaped in the heading, but not inside the inline code. A name may be dotted, such as
`{@ engines.node @}`, and is looked up in nested objects. A placeholder with no value is kept as written, so
templates can be chained: fill what you know now, and the rest in a later step.

Templates are also the way to write what has no builder, such as a table:

```ts
md.blockTemplate('| Package | Version |\n| --- | --- |\n| {@ name @} | {@ version @} |\n', {
  name: md.link('cspell', 'https://cspell.org'),
  version: md.inlineCode('9.0'),
});
```

- `template` returns inline content when the result is one paragraph, and blocks otherwise.
- `blockTemplate` always returns blocks.
- `inlineTemplate` requires one paragraph, for use inside a line.
- `parse` reads Markdown made elsewhere as a value, without filling anything.

## Fill placeholders later

A placeholder with no value yet is kept as written, so content can be built in steps.

```ts
const draft = md.document(md.heading(1, 'Report'), md.blockPlaceholder('body'));
// # Report
//
// {@ body @}

const done = md.substitutePlaceholders(draft, { body: md.list(['All checks passed']) });
// # Report
//
// - All checks passed
```

## Match an existing style

The default style uses `-` bullets, `_` emphasis, `**` strong and `---` rules. To match a document that already
exists, detect its style and render in it:

```ts
const style = md.detectStyle(existingMarkdown); // e.g. { bullet: '*', emphasis: '*', ... }
md.document(md.list(['a', md.emphasis('b')]))
  .withStyle(style)
  .toString();
// * a
// * *b*
```

A template or parsed fragment is re-rendered. It tries to keep the style of its own text, but spacing and table
padding may change.

## What's included

- Inline: `text`, `inlineCode`, `link`, `strong`, `emphasis`, `strikethrough`, `lineBreak`, `br`, `comment`,
  `placeholder`
- Blocks: `heading`, `paragraph`, `blockText`, `list`, `listItem`, `codeBlock`, `horizontalRule` (`hr`),
  `blockPlaceholder`, `toBlock`
- A whole document: `document`
- Templates and placeholders: `template`, `blockTemplate`, `inlineTemplate`, `parse`, `substitutePlaceholders`
- Style: `detectStyle`, and `withStyle` on a document

There are no builders yet for tables, ordered lists, block quotes or images. Write those as a template.

Every value renders with `toString()`. A document ends with a newline; other values don't, so they can be joined.

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
