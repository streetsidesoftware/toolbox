### Code blocks

Give `codeBlock` the code and, optionally, its language. The code goes in as written.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p('Install cspell as a dev dependency:'),
  md.codeBlock('npm install --save-dev cspell', 'sh'),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

````markdown
Install cspell as a dev dependency:

```sh
npm install --save-dev cspell
```
````

<!--- @@inject-end: output.md --->
