## Add frontmatter to a generated page

Sites such as Docusaurus read a page's settings from YAML frontmatter at its start. Put `frontmatter` first in a
document. Its text is inserted as is, between `---` lines, so making it valid YAML is up to you.

<!--- @@inject: example.ts --->

```ts
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
