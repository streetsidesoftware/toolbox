import * as md from '@streetsidesoftware/markdown-toolkit';

const title = 'Code Spell Checker';

const yaml = [
  '# Generated: edit the script, not this file.',
  `title: ${title}`,
  'sidebar_position: 1',
].join('\n');

const page = md.document(
  md.frontmatter(yaml),
  md.heading(1, title),
  md.p('Settings that control the behavior of the spell checker.'),
);

console.log(page.toString());
