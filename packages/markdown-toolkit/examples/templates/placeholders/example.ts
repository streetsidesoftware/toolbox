import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const pkg = {
  name: '@cspell/dict-nl-nl',
  description: 'Dutch dictionary for cspell.',
};

const section = md.template(
  markdown`
    ## {@ pkg.name @}

    {@ pkg.description @}

    Install with \`npm i -D {@ pkg.name @}\`.
  `,
  { pkg },
);

console.log(section.toString());
