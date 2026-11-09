### Dotted names

A dotted name, such as `pkg.engines.node`, can come from nested objects, from a top-level key with the dots in it, or
from both at once. When two keys supply a name, the later one wins, so the license is MIT. Dots in a nested key don't
split it, so the last placeholder below has no value and is kept.

<!--- @@inject: example.ts --->

```ts
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
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
## @cspell/dict-nl-nl

- Node: >=20
- License: MIT
- [Issues](https://github.com/streetsidesoftware/cspell/issues)
- Lodash optional: {@ peerDependenciesMeta.lodash.optional @}
```

<!--- @@inject-end: output.md --->
