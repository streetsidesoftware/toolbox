import * as md from '@streetsidesoftware/markdown-toolkit';

// Text from a package.json, a user, or anywhere else.
const name = '@cspell/dict-en_us';
const description = '1. Use *any* [text] here';

const doc = md.document(
  md.heading(2, name),
  md.paragraph(description),
  md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'),
);

process.stdout.write(doc.toString());
