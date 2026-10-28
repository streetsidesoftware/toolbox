## Make a table from data

Give `table` the header and one array of cells per row. A cell holds inline content, such as text, inline code, links
and strong text. A `|` is escaped wherever it lands, even inside inline code, so it doesn't end the cell. A
`lineBreak()` renders as `<br/>`, since a Markdown line break would end the row.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const commands = [
  { command: 'cSpell.addWordToDictionary', title: 'Add Words to Dictionary' },
  { command: 'cSpell.toggleEnableSpellChecker', title: 'Toggle Spell Checking', when: 'editorTextFocus || isMac' },
];

const doc = md.document(
  md.heading(2, 'Commands'),
  md.table(
    ['Command', 'Title'],
    commands.map((c) => [
      md.inlineCode(c.command),
      c.when ? [c.title, md.lineBreak(), md.strong('When:'), ' ', md.inlineCode(c.when)] : c.title,
    ]),
  ),
);

process.stdout.write(doc.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## Commands

| Command                           | Title                                                            |
| --------------------------------- | ---------------------------------------------------------------- |
| `cSpell.addWordToDictionary`      | Add Words to Dictionary                                          |
| `cSpell.toggleEnableSpellChecker` | Toggle Spell Checking<br/>**When:** `editorTextFocus \|\| isMac` |
```

<!--- @@inject-end: output.md --->

A short row is filled with empty cells. To align a column, pass `{ align: [undefined, 'right'] }`, one entry per
column. An entry can also be written as in the table, such as `:-:` or `-:`.
