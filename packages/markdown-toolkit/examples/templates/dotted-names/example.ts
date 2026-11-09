import * as md from '@streetsidesoftware/markdown-toolkit';
import { unindent as markdown } from '@streetsidesoftware/unindent';

const values = {
  pkg: {
    name: '@cspell/dict-nl-nl',
    engines: { node: '>=20' },
    license: 'GPL',
  },
  'pkg.license': 'MIT',
  'repo.links': {
    issues: 'https://github.com/streetsidesoftware/cspell/issues',
  },
  peerDependenciesMeta: {
    'lodash.optional': 'true', // not found
  },
};

const section = md.template(
  markdown`
    ## {@ pkg.name @}

    - Node: {@ pkg.engines.node @}
    - License: {@ pkg.license @}
    - [Issues]({@repo.links.issues@})
    - Lodash optional: {@ peerDependenciesMeta.lodash.optional @}
  `,
  values,
);

console.log(section.toString());
