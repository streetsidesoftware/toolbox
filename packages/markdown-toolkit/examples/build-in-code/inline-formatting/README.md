### Links and inline formatting

These go inside a line: `link`, `inlineCode`, `strong`, `emphasis`, `strikethrough`, `sup` and `sub`. Each one
except `inlineCode` takes inline content, so they nest, as in a link with strong text. For HTML or MDX, `sup` and
`sub` write `<sup>` and `<sub>` tags around their content.

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
  md.p('language', md.sup(md.emphasis('req')), ': the language to check.'),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
Run `npx cspell .` to check **every** file.

See [the docs](https://cspell.org) for options.

language<sup>_req_</sup>: the language to check.
```

<!--- @@inject-end: output.md --->
