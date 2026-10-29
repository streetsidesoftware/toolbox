import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.templateDocument(
  fs.readFileSync('template.md', 'utf8'),
  {
    title: 'CSpell',
    description: [
      'Settings for the cspell command line tool.',
      'They apply to every file it checks.',
    ].join('\n'),
  },
);

console.log(page.toString());
