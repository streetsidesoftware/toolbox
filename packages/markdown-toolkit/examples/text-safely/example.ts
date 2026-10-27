import * as md from '@streetsidesoftware/markdown-toolkit';

// Text from a package.json, a user, or anywhere else.
const name = 'my_package*';
const description = '1. Use *any* [text] here';

const doc = md.document(
  md.heading(2, name),
  md.paragraph(description),
  md.paragraph('Install with ', md.inlineCode(`npm i ${name}`), '.'),
);

process.stdout.write(doc.toString());
