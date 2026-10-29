### Tables

Give `table` the header and one array of cells per row. A cell holds inline content, such as text, inline code and
links. To align a column, pass `{ align: ['left', 'right'] }`, one entry per column.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl', locale: 'nl' },
  { language: 'French', name: '@cspell/dict-fr-fr', locale: 'fr' },
  { language: 'German', name: '@cspell/dict-de-de', locale: 'de' },
];

const page = md.document(
  md.table(
    ['Language', 'Package', 'Locale'],
    dictionaries.map((d) => [
      d.language,
      md.inlineCode(d.name),
      d.locale,
    ]),
  ),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
| Language | Package              | Locale |
| -------- | -------------------- | ------ |
| Dutch    | `@cspell/dict-nl-nl` | nl     |
| French   | `@cspell/dict-fr-fr` | fr     |
| German   | `@cspell/dict-de-de` | de     |
```

<!--- @@inject-end: output.md --->
