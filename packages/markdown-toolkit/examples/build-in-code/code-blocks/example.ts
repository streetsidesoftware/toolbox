import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.p('Install cspell as a dev dependency:'),
  md.codeBlock('npm install --save-dev cspell', 'sh'),
);

console.log(page.toString());
