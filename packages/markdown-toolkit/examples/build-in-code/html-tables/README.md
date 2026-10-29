### HTML tables

When a cell needs more than one line, such as a list or a code block, use `htmlTable`. It takes the same header,
rows and options as `table`, and a cell can hold any content. GitHub renders the HTML table it writes.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const options = [
  { name: '--words', description: 'Words to accept as correct.' },
  {
    name: '--languages',
    description: [
      'The languages to check:',
      md.list(['en for English', 'nl for Dutch']),
    ],
  },
];

const page = md.document(
  md.htmlTable(
    ['Option', 'Description'],
    options.map((o) => [md.inlineCode(o.name), o.description]),
  ),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
<table>
<thead>
<tr>
<th>Option</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`--words`

</td>
<td>Words to accept as correct.</td>
</tr>
<tr>
<td>

`--languages`

</td>
<td>

The languages to check:

- en for English
- nl for Dutch

</td>
</tr>
</tbody>
</table>
```

<!--- @@inject-end: output.md --->
