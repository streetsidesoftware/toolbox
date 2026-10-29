### Links and inline formatting

These go inside a line: `link`, `inlineCode`, `strong`, `emphasis` and `strikethrough`. Each one except
`inlineCode` takes inline content, so they nest, as in a link with strong text.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
Run `npx cspell .` to check **every** file.

See [the docs](https://cspell.org) for options.
```

<!--- @@inject-end: output.md --->
