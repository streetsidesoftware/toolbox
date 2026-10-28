import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const name = 'cspell';

const doc = md.templateDocument(
  markdown`
    # {@ name @}

    Install with \`npm i {@ name @}\`.
  `,
  { name },
);

process.stdout.write(doc.toString());
