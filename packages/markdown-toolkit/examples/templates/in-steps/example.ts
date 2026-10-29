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
