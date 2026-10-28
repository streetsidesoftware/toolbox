import * as md from '@streetsidesoftware/markdown-toolkit';

const name = 'cspell';

const doc = md.document(md.heading(1, name), md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'));

process.stdout.write(doc.toString());
