### Markdown from elsewhere

A string is always text. For a string that is already Markdown, such as a description from another file, pass
`parse(text)` instead. Like a template, it gives inline content or blocks, and `toBlock` makes either fit where
only blocks can go.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// From the dictionary's own docs, already written as Markdown.
const about =
  'Adds **Dutch** words. See [cspell.org](https://cspell.org).';

const page = md.document(md.heading(2, 'About'), md.parse(about));

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## About

Adds **Dutch** words. See [cspell.org](https://cspell.org).
```

<!--- @@inject-end: output.md --->
