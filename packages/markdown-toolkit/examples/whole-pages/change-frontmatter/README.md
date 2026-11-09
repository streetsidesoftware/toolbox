### Change the frontmatter

A page read with `parseDocument` holds its frontmatter's YAML text in `frontmatter`, or `undefined` when it has none.
Its `withFrontmatter` returns a copy with new frontmatter.

<details>
<summary>Example</summary>

<!--- @@inject-code: page.md --->

```markdown
---
title: CSpell
sidebar_position: 3
---

# CSpell

Settings for the cspell command line tool.
```

<!--- @@inject-end: page.md --->

<!--- @@inject: example.ts --->

```ts
import fs from 'node:fs';

import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.parseDocument(fs.readFileSync('page.md', 'utf8'));

const yaml = page.frontmatter?.replace(
  'sidebar_position: 3',
  'sidebar_position: 1',
);

const updated = page.withFrontmatter(yaml);

console.log(updated.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
---
title: CSpell
sidebar_position: 1
---

# CSpell

Settings for the cspell command line tool.
```

<!--- @@inject-end: output.md --->

</details>

To remove the frontmatter, pass `undefined`.
