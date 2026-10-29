### Text and paragraphs

Pass one or more pieces to `p` (`paragraph`) to make a paragraph. The pieces are joined as given, with no spaces
added. To turn plain text into paragraphs, use `blockText`: each blank line starts a new paragraph.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
A spell checker for code. It works offline.

It checks comments, strings and Markdown.

It runs in CI and in the editor.
```

<!--- @@inject-end: output.md --->
