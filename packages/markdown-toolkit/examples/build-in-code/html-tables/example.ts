import * as md from '@streetsidesoftware/markdown-toolkit';

const options = [
  { name: '--words', description: 'Words to accept as correct.' },
  {
    name: '--languages',
    description: [
      'The languages to check:',
      md.list(['en for English', 'nl for Dutch']),
    ],
  },
];

const page = md.document(
  md.htmlTable(
    ['Option', 'Description'],
    options.map((o) => [md.inlineCode(o.name), o.description]),
  ),
);

console.log(page.toString());
