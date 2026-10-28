import * as md from '@streetsidesoftware/markdown-toolkit';

const name = 'cspell';

const doc = md.document(
  md.heading(1, name),
  md.list([md.link('Docs', 'https://cspell.org'), md.link('Source', 'https://github.com/streetsidesoftware/cspell')]),
  md.codeBlock(`npm i ${name}`, 'sh'),
);

process.stdout.write(doc.toString());
