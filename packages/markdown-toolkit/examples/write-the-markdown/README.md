## Write the Markdown yourself, with data in it

A template is Markdown with `{@ name @}` placeholders. A string value is escaped, an element is inserted as
Markdown, and a placeholder on a line of its own can take blocks, such as a list.

The template is indented to match the code, and `unindent` from [`@streetsidesoftware/unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) removes the indentation. Imported as
`markdown`, the tag also tells editors and Prettier that the text is Markdown, so it's highlighted and formatted as
Markdown.

<!--- @@inject: example.ts --->

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
    name: '@cspell/dict-en_us',
    docs: md.link('the docs', 'https://example.com'),
    features: md.list(['Fast', ['Escapes ', md.inlineCode('*'), ' for you']]),
  },
);

console.log(readme.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## @cspell/dict-en_us

Install with `npm i @cspell/dict-en_us`, then see [the docs](https://example.com).

- Fast
- Escapes `*` for you
```

<!--- @@inject-end: output.md --->

A name may be dotted, such as `{@ engines.node @}`, and is looked up in nested objects.

- `template` returns inline content when the result is one paragraph, and blocks otherwise.
- `blockTemplate` always returns blocks.
- `inlineTemplate` requires one paragraph, for use inside a line.

Text that is already Markdown, such as a `markdownDescription`, goes in as Markdown with `md.parse(text)`.
