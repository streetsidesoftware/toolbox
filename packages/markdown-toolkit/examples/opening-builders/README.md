## Or build it in code

The same page, built in code. Each builder returns a Markdown element. Put them together with `document`, and
render the file with `toString()`.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const name = 'cspell';

const doc = md.document(
  md.heading(1, name),
  md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'),
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
