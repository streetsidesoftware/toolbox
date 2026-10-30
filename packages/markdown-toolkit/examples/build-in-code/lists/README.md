### Lists

Give `list` an array with one entry per item. An entry can be an array of pieces, and a `list` among them makes a
nested list.

For a numbered list, use `ol`, or `list` with `ordered: true`. Every item in the Markdown repeats the first number,
and the page counts up from it.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = {
  Languages: ['Dutch', 'French', 'German'],
  Programming: ['Python', 'Rust', 'TypeScript'],
};

const page = md.document(
  md.list(
    Object.entries(dictionaries).map(([group, names]) => [
      group,
      md.list(names),
    ]),
  ),
  md.p('To add one:'),
  md.ol(['Install the dictionary.', 'Add it to the config.']),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
- Languages
  - Dutch
  - French
  - German
- Programming
  - Python
  - Rust
  - TypeScript

To add one:

1. Install the dictionary.
1. Add it to the config.
```

<!--- @@inject-end: output.md --->
