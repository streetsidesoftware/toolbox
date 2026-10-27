import * as md from '@streetsidesoftware/markdown-toolkit';

const links = [
  { title: 'Docs [beta]', url: 'https://cspell.org' },
  { title: 'Source', url: 'https://github.com/streetsidesoftware/cspell' },
];

const doc = md.document(
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.list(links.map(({ title, url }) => md.link(title, url))),
  md.codeBlock('npm install -D cspell', 'sh'),
);

process.stdout.write(doc.toString());
