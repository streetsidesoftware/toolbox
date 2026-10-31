### Values from a function

In place of an object, pass a function that takes a placeholder name and returns its value. It gets the whole name,
such as `dictionaries.custom`, not one part at a time. Values can then come from a `Map`, a config file or anywhere
else. When it returns
`undefined`, the placeholder is kept for a later step.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const settings = new Map([
  ['language', 'en, nl'],
  ['dictionaries.custom', 'project-words'],
]);

const section = md.template(
  markdown`
    Languages: {@ language @}

    Custom dictionary: \`{@ dictionaries.custom @}\`

    Added on: {@ date @}
  `,
  (name) => settings.get(name),
);

console.log(section.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
Languages: en, nl

Custom dictionary: `project-words`

Added on: {@ date @}
```

<!--- @@inject-end: output.md --->
