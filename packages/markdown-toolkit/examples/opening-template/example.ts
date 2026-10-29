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
