### Build a page in steps

Several steps can each substitute what they know. Pass the result of one step to `substitutePlaceholders` to
substitute more of its placeholders. A placeholder with no value yet is kept as written, so a later step, or a tool
such as [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), can substitute it. In code,
`placeholder(name)` leaves the same gap inside a line, and `blockPlaceholder(name)` on lines of its own.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const layout = md.template(
  markdown`
    # {@ title @}

    {@ summary @}

    ## Results

    {@ results @}

    Last run: {@ date @}
  `,
  { title: 'Spell check report' },
);

const summarized = md.substitutePlaceholders(layout, {
  summary: md.p('Checked 2 files.'),
});
const report = md.substitutePlaceholders(summarized, {
  results: md.list([
    'README.md: no issues',
    'docs/guide.md: 1 unknown word',
  ]),
});

console.log(report.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
# Spell check report

Checked 2 files.

## Results

- README.md: no issues
- docs/guide.md: 1 unknown word

Last run: {@ date @}
```

<!--- @@inject-end: output.md --->
