## Generate a Markdown file from data

A script usually has its data in arrays and objects. Map each item to an element, here a link in a list, and put
the elements together with `document`.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const links = [
  { title: 'Docs', url: 'https://cspell.org' },
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

- [Docs](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm install -D cspell
```
````

<!--- @@inject-end: output.md --->
