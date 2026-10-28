import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const readme = md.template(
  markdown`
    ## {@ name @}

    Install with \`npm i {@ name @}\`, then see {@ docs @}.

    {@ features @}
  `,
  {
    name: '@cspell/dict-nl-nl',
    docs: md.link('the docs', 'https://github.com/streetsidesoftware/cspell-dicts/tree/main/dictionaries/nl_NL'),
    features: md.list([
      'Dutch words',
      ['Import ', md.inlineCode('@cspell/dict-nl-nl/cspell-ext.json'), ' in your cspell config'],
    ]),
  },
);

console.log(readme.toString());
