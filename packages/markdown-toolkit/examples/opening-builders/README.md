## Or build it from data

Each builder returns a Markdown element. Put them together with `document`, and render the file with `toString()`.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const name = 'cspell';

const doc = md.document(
  md.heading(1, name),
  md.list([md.link('Docs', 'https://cspell.org'), md.link('Source', 'https://github.com/streetsidesoftware/cspell')]),
  md.codeBlock(`npm i ${name}`, 'sh'),
);

process.stdout.write(doc.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

````markdown
# cspell

- [Docs](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm i cspell
```
````

<!--- @@inject-end: output.md --->
