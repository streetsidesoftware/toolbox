import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.details(
    'Supported file types',
    md.list(['Markdown', 'Python', 'TypeScript']),
  ),
  md.dl([
    ['language', 'The languages to check, such as en or nl.'],
    ['words', 'Words to accept as correct.'],
  ]),
);

console.log(page.toString());
