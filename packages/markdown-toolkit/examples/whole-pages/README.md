## Whole pages

A page for a site such as Docusaurus often starts with YAML frontmatter.

<!--- @@inject: frontmatter/README.md --->

### Frontmatter

Put `frontmatter` first in a document. Its text is YAML and goes in as written, between `---` lines.

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

```markdown
---
# Generated: edit the script, not this file.
title: Code Spell Checker
sidebar_position: 1
---

# Code Spell Checker

Settings that control the behavior of the spell checker.
```

<!--- @@inject-end: frontmatter/README.md --->

<!--- @@inject: template-files/README.md --->

### Template files

A template for a whole page, such as `template.md`, can start with frontmatter:

```markdown
---
title: {@ title @}
description: >-
  {@ description @}
---

# {@ title @}

{@ description @}
```

Read it with `templateDocument`, which keeps the frontmatter and substitutes the placeholders in both parts. A value
in the frontmatter goes in as written, since it's YAML.

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.templateDocument(
  fs.readFileSync('template.md', 'utf8'),
  {
    title: 'CSpell',
    description: [
      'Settings for the cspell command line tool.',
      'They apply to every file it checks.',
    ].join('\n'),
  },
);

console.log(page.toString());
```

```markdown
---
title: CSpell
description: >-
  Settings for the cspell command line tool.
  They apply to every file it checks.
---

# CSpell

Settings for the cspell command line tool.\
They apply to every file it checks.
```

To read a whole page without substituting anything, use `parseDocument`.

<!--- @@inject-end: template-files/README.md --->
