import * as md from '@streetsidesoftware/markdown-toolkit';

const title = 'Code Spell Checker';

const page = md.document(
  md.frontmatter(`# AUTO-GENERATED: edit the script, not this file.
title: ${title}
id: code-spell-checker
`),
  md.heading(1, title),
  md.paragraph('Settings that control the behavior of the spell checker.'),
);

process.stdout.write(page.toString());
