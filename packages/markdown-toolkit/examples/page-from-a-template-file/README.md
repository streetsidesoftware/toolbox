## Generate a page from a template file

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

`templateDocument` reads it as a whole page, keeps its frontmatter, and substitutes the placeholders in both. The
frontmatter is YAML, not Markdown, so a value there is inserted as is. Each line of a value after the first gets the
indentation of the placeholder's line, so a multi-line value stays inside a YAML block such as `>-`.

<!--- @@inject: example.ts --->

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.templateDocument(fs.readFileSync('template.md', 'utf8'), {
  title: 'CSpell',
  description: 'Settings for the cspell command line tool.\nThey apply to every file it checks.',
});

process.stdout.write(page.toString());
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

`parseDocument` reads a whole page without substituting anything. `template` and `parse` read a part of a page instead,
where a leading `---` is a horizontal rule.
