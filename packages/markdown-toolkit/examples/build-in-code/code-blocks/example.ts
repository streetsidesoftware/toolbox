import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p('Install cspell as a dev dependency:'),
  md.codeBlock('npm install -D cspell', 'sh'),
);

console.log(page.toString());
