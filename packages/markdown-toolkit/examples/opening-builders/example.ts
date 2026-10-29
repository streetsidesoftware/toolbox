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
