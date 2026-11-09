## Whole pages

A page for a site such as Docusaurus often starts with YAML frontmatter.

<!--- @@inject: frontmatter/README.md --->

### Frontmatter

Put `frontmatter` first in a document. Its text is YAML and goes in as written, between `---` lines.

<details>
<summary>Example</summary>

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

</details>

<!--- @@inject-end: frontmatter/README.md --->

<!--- @@inject: template-files/README.md --->

### Template files

A template for a whole page, such as `template.md`, can start with frontmatter. Read it with `templateDocument`, which
keeps the frontmatter and substitutes the placeholders in both parts. A value in the frontmatter goes in as written,
since it's YAML.

<details>
<summary>Example</summary>

```markdown
---
title: {@ title @}
description: >-
  {@ description @}
---

# {@ title @}

{@ description @}
```

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

</details>

To read a whole page without substituting anything, use `parseDocument`.

<!--- @@inject-end: template-files/README.md --->

<!--- @@inject: change-frontmatter/README.md --->

### Change the frontmatter

A page read with `parseDocument` holds its frontmatter's YAML text in `frontmatter`, or `undefined` when it has none.
Its `withFrontmatter` returns a copy with new frontmatter.

<details>
<summary>Example</summary>

```markdown
---
title: CSpell
sidebar_position: 3
---

# CSpell

Settings for the cspell command line tool.
```

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.parseDocument(fs.readFileSync('page.md', 'utf8'));

const yaml = page.frontmatter?.replace(
  'sidebar_position: 3',
  'sidebar_position: 1',
);

console.log(page.withFrontmatter(yaml).toString());
```

```markdown
---
title: CSpell
sidebar_position: 1
---

# CSpell

Settings for the cspell command line tool.
```

</details>

It also takes an element made by `frontmatter`, and `undefined` removes the frontmatter.

<!--- @@inject-end: change-frontmatter/README.md --->
