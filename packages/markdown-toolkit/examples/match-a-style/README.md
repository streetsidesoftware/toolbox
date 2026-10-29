## Match an existing file's style

Lists use `-` bullets and emphasis uses `_` by default. To add to a file that uses another style, detect its style
and render in it.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// The README being updated uses `*` bullets.
const existing = '# Dictionaries\n\n* Dutch\n* French\n';

const section = md
  .document(md.list(['German', 'Spanish']))
  .withStyle(md.detectStyle(existing));

console.log(section.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
* German
* Spanish
```

<!--- @@inject-end: output.md --->
