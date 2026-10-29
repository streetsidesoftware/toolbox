## With a template

Write the Markdown you want, mark the gaps with `{@ name @}`, and substitute values for them.
[`unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent), from `@streetsidesoftware/unindent`, removes
the indentation.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
# cspell

Install with `npm i cspell`.
```

<!--- @@inject-end: output.md --->
