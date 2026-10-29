## With a template

Write the page as Markdown, mark each gap with a `{@ name @}` placeholder, and substitute values for them. A value
can be a string or an element, such as a link or a list.
[`unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) removes the template's indentation.
Imported as `markdown`, it also gets editors to highlight the template as Markdown.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const dictionaries = [
  { language: 'Dutch', name: '@cspell/dict-nl-nl' },
  { language: 'French', name: '@cspell/dict-fr-fr' },
  { language: 'German', name: '@cspell/dict-de-de' },
];

const page = md.templateDocument(
  markdown`
    # Dictionaries

    Language dictionaries for {@ cspell @}.

    {@ dictionaries @}
  `,
  {
    cspell: md.link('cspell', 'https://cspell.org'),
    dictionaries: md.list(
      dictionaries.map((d) => md.link(d.language, npmUrl(d.name))),
    ),
  },
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
