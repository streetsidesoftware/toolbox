import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const settings = new Map([
  ['language', 'en, nl'],
  ['dictionaries.custom', 'project-words'],
]);

const section = md.template(
  markdown`
    Languages: {@ language @}

    Custom dictionary: \`{@ dictionaries.custom @}\`

    Added on: {@ date @}
  `,
  (name) => settings.get(name),
);

console.log(section.toString());
