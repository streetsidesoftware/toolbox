import * as md from '@streetsidesoftware/markdown-toolkit';

// The file being updated uses `*` bullets and `*` emphasis.
const existing = '# Fruit\n\n* Apples\n* *Pears*\n';

const section = md.document(md.list(['Plums', md.emphasis('Cherries')])).withStyle(md.detectStyle(existing));

process.stdout.write(section.toString());
