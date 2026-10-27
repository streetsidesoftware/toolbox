import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const readme = md.template(
  markdown`
    ## {@ name @}

    Install with \`npm i {@ name @}\`, then see {@ docs @}.

    {@ features @}
  `,
  {
    name: 'my_package*',
    docs: md.link('the docs', 'https://example.com'),
    features: md.list(['Fast', ['Escapes ', md.inlineCode('*'), ' for you']]),
  },
);

console.log(readme.toString());
