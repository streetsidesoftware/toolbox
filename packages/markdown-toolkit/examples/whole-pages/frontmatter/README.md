### Frontmatter

Put `frontmatter` first in a document. Its text is YAML and goes in as written, between `---` lines.

<!--- @@inject: example.ts --->

```ts
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
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
---
# Generated: edit the script, not this file.
title: Code Spell Checker
sidebar_position: 1
---

# Code Spell Checker

Settings that control the behavior of the spell checker.
```

<!--- @@inject-end: output.md --->
