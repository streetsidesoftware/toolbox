import * as md from '@streetsidesoftware/markdown-toolkit';

// The layout, with the title this step knows.
const layout = md.template(
  `# {@ title @}

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
