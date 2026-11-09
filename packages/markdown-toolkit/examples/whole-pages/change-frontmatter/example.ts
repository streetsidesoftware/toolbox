import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.parseDocument(fs.readFileSync('page.md', 'utf8'));

const yaml = page.frontmatter?.replace(
  'sidebar_position: 3',
  'sidebar_position: 1',
);

const updated = page.withFrontmatter(yaml);

console.log(updated.toString());
