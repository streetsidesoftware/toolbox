import * as md from '@streetsidesoftware/markdown-toolkit';

// The README being updated uses `*` bullets.
const existing = '# Dictionaries\n\n* Dutch\n* French\n';

const section = md
  .document(md.list(['German', 'Spanish']))
  .withStyle(md.detectStyle(existing));

console.log(section.toString());
