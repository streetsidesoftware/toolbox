## Write the Markdown yourself, with data in it

A template is Markdown with `{@ name @}` placeholders. A string value is inserted as text, an element as Markdown,
and a placeholder on a line of its own can take blocks, such as a list. If a string is already Markdown, pass
`md.parse(text)`.

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
    name: '@cspell/dict-nl-nl',
    docs: md.link('the docs', 'https://github.com/streetsidesoftware/cspell-dicts/tree/main/dictionaries/nl_NL'),
    features: md.list(['Dutch words', ['Import ', md.inlineCode('@cspell/dict-nl-nl/cspell-ext.json'), ' in your cspell config']]),
  },
);

console.log(readme.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## @cspell/dict-nl-nl

Install with `npm i @cspell/dict-nl-nl`, then see [the docs](https://github.com/streetsidesoftware/cspell-dicts/tree/main/dictionaries/nl_NL).

- Dutch words
- Import `@cspell/dict-nl-nl/cspell-ext.json` in your cspell config
```

<!--- @@inject-end: output.md --->

A name may be dotted, such as `{@ engines.node @}`, and is looked up in nested objects.

- `template` returns inline content when the result is one paragraph, and blocks otherwise.
- `blockTemplate` always returns blocks.
- `inlineTemplate` requires one paragraph, for use inside a line.
