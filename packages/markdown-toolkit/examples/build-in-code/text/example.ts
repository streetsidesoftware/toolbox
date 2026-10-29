import * as md from '@streetsidesoftware/markdown-toolkit';

const summary = 'A spell checker for code.';
const notes = [
  'It checks comments, strings and Markdown.',
  '',
  'It runs in CI and in the editor.',
].join('\n');

const page = md.document(
  md.p(summary, ' It works offline.'),
  md.blockText(notes),
);

console.log(page.toString());
