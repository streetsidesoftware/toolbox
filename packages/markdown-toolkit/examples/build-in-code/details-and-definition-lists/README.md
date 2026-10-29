### Details and definition lists

These are HTML blocks, which GitHub renders. Give `details` a summary and the content it hides. Give
`definitionList` (`dl`) one `[term, definition]` pair per entry.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.details(
    'Supported file types',
    md.list(['Markdown', 'Python', 'TypeScript']),
  ),
  md.dl([
    ['language', 'The languages to check, such as en or nl.'],
    ['words', 'Words to accept as correct.'],
  ]),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
<details>
<summary>Supported file types</summary>

- Markdown
- Python
- TypeScript

</details>

<dl>

<dt>language</dt>
<dd>

The languages to check, such as en or nl.

</dd>

<dt>words</dt>
<dd>

Words to accept as correct.

</dd>

</dl>
```

<!--- @@inject-end: output.md --->
