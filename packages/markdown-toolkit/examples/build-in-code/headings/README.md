### Headings

Give `heading` a depth from 1 to 6 and its text. The text can be several pieces, such as text and inline code. To
separate sections with a line, use `horizontalRule()` (`hr()`).

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
# cspell

A spell checker for code.

## Using `cspell`

Run it on every file in the project.
```

<!--- @@inject-end: output.md --->
