### Template files

A template for a whole page, such as `template.md`, can start with frontmatter:

<!--- @@inject-code: template.md --->

```markdown
---
title: {@ title @}
description: >-
  {@ description @}
---

# {@ title @}

{@ description @}
```

<!--- @@inject-end: template.md --->

Read it with `templateDocument`, which keeps the frontmatter and substitutes the placeholders in both parts. A value
in the frontmatter goes in as written, since it's YAML.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
---
title: CSpell
description: >-
  Settings for the cspell command line tool.
  They apply to every file it checks.
---

# CSpell

Settings for the cspell command line tool.
They apply to every file it checks.
```

<!--- @@inject-end: output.md --->

To read a whole page without substituting anything, use `parseDocument`.
