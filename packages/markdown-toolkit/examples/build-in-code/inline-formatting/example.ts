import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p(
    'Run ',
    md.inlineCode('npx cspell .'),
    ' to check ',
    md.strong('every'),
    ' file.',
  ),
  md.p(
    'See ',
    md.link('the docs', 'https://cspell.org'),
    ' for options.',
  ),
  md.p(
    'language',
    md.sup(md.emphasis('req')),
    ': the language to check.',
  ),
);

console.log(page.toString());
