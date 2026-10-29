## Or build it in code

The same page, built from elements. Each builder returns an element, and `document` puts them together into a page.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl' },
  { language: 'French', name: '@cspell/dict-fr-fr' },
  { language: 'German', name: '@cspell/dict-de-de' },
];

const page = md.document(
  md.heading(1, 'Dictionaries'),
  md.p(
    'Language dictionaries for ',
    md.link('cspell', 'https://cspell.org'),
    '.',
  ),
  md.list(
    dictionaries.map((d) => md.link(d.language, npmUrl(d.name))),
  ),
);

console.log(page.toString());

function npmUrl(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
# Dictionaries

Language dictionaries for [cspell](https://cspell.org).

- [Dutch](https://www.npmjs.com/package/@cspell/dict-nl-nl)
- [French](https://www.npmjs.com/package/@cspell/dict-fr-fr)
- [German](https://www.npmjs.com/package/@cspell/dict-de-de)
```

<!--- @@inject-end: output.md --->
