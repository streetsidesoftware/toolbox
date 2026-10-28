## Put any text into Markdown safely

Text that comes from elsewhere, such as a `package.json` or a user, can contain characters that mean something in
Markdown. A string given to a builder is always text: it's escaped for where it ends up, so a `*`, `[` or `1.` in it
stays as written. Inside inline code, nothing needs escaping, so nothing is.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// Text from a package.json, a user, or anywhere else.
const name = '@cspell/dict-en_us';
const description = '1. Use *any* [text] here';

const doc = md.document(
  md.heading(2, name),
  md.paragraph(description),
  md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'),
);

process.stdout.write(doc.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## @cspell/dict-en_us

1\. Use \*any\* \[text] here

Install with `npm i @cspell/dict-en_us`.
```

<!--- @@inject-end: output.md --->

Text that is already Markdown, such as a `markdownDescription`, goes in as Markdown with `md.parse(text)`.
