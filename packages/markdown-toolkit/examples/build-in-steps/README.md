## Build a page in steps

A page can be built by several steps, each filling in what it knows. `substitutePlaceholders` takes the result of
one step and fills more of its placeholders. A placeholder that no step has a value for is kept as written, so a
later step, or a tool such as inject-markdown, can fill it.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

// The layout, with the title this step knows.
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

// Each later step fills in what it knows, and passes the rest on.
const summarized = md.substitutePlaceholders(layout, { summary: md.paragraph('Checked 2 files.') });
const report = md.substitutePlaceholders(summarized, {
  results: md.list(['README.md: no issues', 'docs/guide.md: 1 unknown word']),
});

// `{@ date @}` is left for a later step, such as inject-markdown.
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
