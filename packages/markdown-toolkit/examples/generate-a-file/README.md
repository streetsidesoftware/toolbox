## Generate a Markdown file from data

Each builder returns a Markdown value, not a string. Put values together with `document`, and render the file with
`toString()`. A value is escaped for where it ends up, so the `]` in the link text doesn't end the link.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const links = [
  { title: 'Docs [beta]', url: 'https://cspell.org' },
  { title: 'Source', url: 'https://github.com/streetsidesoftware/cspell' },
];

const doc = md.document(
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.list(links.map(({ title, url }) => md.link(title, url))),
  md.codeBlock('npm install -D cspell', 'sh'),
);

process.stdout.write(doc.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

````markdown
## Using `cspell`

- [Docs \[beta\]](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm install -D cspell
```
````

<!--- @@inject-end: output.md --->
