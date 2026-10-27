## Match the style of the file you're updating

By default, lists use `-` bullets and emphasis uses `_`. To fit into a file that already exists, detect the style
it uses and render in it:

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// The file being updated uses `*` bullets and `*` emphasis.
const existing = '# Fruit\n\n* Apples\n* *Pears*\n';

const section = md.document(md.list(['Plums', md.emphasis('Cherries')])).withStyle(md.detectStyle(existing));

process.stdout.write(section.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
* Plums
* *Cherries*
```

<!--- @@inject-end: output.md --->

A template or parsed text keeps the style of its own text, but spacing and table padding may change.
