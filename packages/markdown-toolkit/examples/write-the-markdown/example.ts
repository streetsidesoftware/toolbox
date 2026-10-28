import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const readme = md.template(
  markdown`
    ## {@ name @}

    Install with \`npm i {@ name @}\`, then see {@ docs @}.

    {@ features @}
  `,
  {
    name: '@cspell/dict-en_us',
    docs: md.link('the docs', 'https://example.com'),
    features: md.list(['American English words', ['Enabled by default in ', md.inlineCode('cspell')]]),
  },
);

console.log(readme.toString());
