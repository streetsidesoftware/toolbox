## Add frontmatter to a generated page

Sites such as Docusaurus read a page's settings from YAML frontmatter at its start. Put `frontmatter` first in a
document. Its text is inserted as is, between `---` lines, so making it valid YAML is up to you.

The YAML here is written with an `unindent` from [`@streetsidesoftware/unindent`](https://www.npmjs.com/package/@streetsidesoftware/unindent) that also drops the newline after the opening backtick, so the
frontmatter doesn't start with a blank line.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { createUnindent } from '@streetsidesoftware/unindent';

const yaml = createUnindent({ trimFirstNewline: true });

const title = 'Code Spell Checker';

const page = md.document(
  md.frontmatter(yaml`
    # AUTO-GENERATED: edit the script, not this file.
    title: ${title}
    id: code-spell-checker
  `),
  md.heading(1, title),
  md.paragraph('Settings that control the behavior of the spell checker.'),
);

process.stdout.write(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
---
# AUTO-GENERATED: edit the script, not this file.
title: Code Spell Checker
id: code-spell-checker
---

# Code Spell Checker

Settings that control the behavior of the spell checker.
```

<!--- @@inject-end: output.md --->
