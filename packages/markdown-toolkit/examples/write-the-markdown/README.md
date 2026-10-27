## Write the Markdown yourself, with data in it

A template is Markdown with `{@ name @}` placeholders. A string value is escaped, a built value is inserted as
Markdown, and a placeholder on a line of its own can take blocks, such as a list.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## my_package\*

Install with `npm i my_package*`, then see [the docs](https://example.com).

- Fast
- Escapes `*` for you
```

<!--- @@inject-end: output.md --->

The name is escaped in the heading, but not inside the inline code. A name may be dotted, such as
`{@ engines.node @}`, and is looked up in nested objects.

- `template` returns inline content when the result is one paragraph, and blocks otherwise.
- `blockTemplate` always returns blocks.
- `inlineTemplate` requires one paragraph, for use inside a line.
