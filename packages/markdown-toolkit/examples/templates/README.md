## Templates

A template is Markdown with `{@ name @}` placeholders. It suits a page that is mostly fixed text, with data in a few
places.

<!--- @@inject: placeholders/README.md --->

### Placeholders

Each `{@ name @}` takes the value of the same name. A string goes in as text, and an element as Markdown. A
placeholder on a line of its own also takes blocks, such as a list or a table. A dotted name, such as
`{@ pkg.name @}`, looks up a nested object, and a placeholder works inside code too.

Use `inlineTemplate` for a template that goes inside a line, and `blockTemplate` for one that must be blocks.

<details>
<summary>Example</summary>

```ts
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
```

```markdown
## @cspell/dict-nl-nl

Dutch dictionary for cspell.

Install with `npm i -D @cspell/dict-nl-nl`.
```

</details>

<!--- @@inject-end: placeholders/README.md --->

<!--- @@inject: existing-markdown/README.md --->

### Markdown from elsewhere

A string is always text. For a string that is already Markdown, such as a description from another file, pass
`parse(text)` instead. Like a template, it gives inline content or blocks, and `toBlock` makes either fit where
only blocks can go.

<details>
<summary>Example</summary>

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

// From the dictionary's own docs, already written as Markdown.
const about =
  'Adds **Dutch** words. See [cspell.org](https://cspell.org).';

const page = md.document(md.heading(2, 'About'), md.parse(about));

console.log(page.toString());
```

```markdown
## About

Adds **Dutch** words. See [cspell.org](https://cspell.org).
```

</details>

<!--- @@inject-end: existing-markdown/README.md --->

<!--- @@inject: in-steps/README.md --->

### Values in steps

When the values come from different places, you can substitute them in steps. Start with `template` and the values you
have. Then pass its result to `substitutePlaceholders` with more values, as many times as you need. A placeholder with
no replacement is kept as written.

<details>
<summary>Example</summary>

```ts
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
```

```markdown
# Spell check report

Checked 2 files.

## Results

- README.md: no issues
- docs/guide.md: 1 unknown word

Last run: {@ date @}
```

</details>

<!--- @@inject-end: in-steps/README.md --->

<!--- @@inject: dotted-names/README.md --->

### Dotted names

A dotted name, such as `pkg.engines.node`, can come from nested objects, from a top-level key with the dots in it, or
from both at once. When two keys supply a name, the later one wins, so the license is MIT. Dots in a nested key don't
split it, so the last placeholder has no replacement and is kept.

<details>
<summary>Example</summary>

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

```markdown
## @cspell/dict-nl-nl

- Node: >=20
- License: MIT
- [Issues](https://github.com/streetsidesoftware/cspell/issues)
- Lodash optional: {@ peerDependenciesMeta.lodash.optional @}
```

</details>

<!--- @@inject-end: dotted-names/README.md --->

<!--- @@inject: resolver/README.md --->

### Values from a function

In place of an object, pass a function that takes a placeholder name and returns its value. It gets the whole name,
such as `dictionaries.custom`, not one part at a time. Values can then come from a `Map`, a config file or anywhere
else. When it returns
`undefined`, the placeholder is kept for a later step.

<details>
<summary>Example</summary>

```ts
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
```

```markdown
Languages: en, nl

Custom dictionary: `project-words`

Added on: {@ date @}
```

</details>

<!--- @@inject-end: resolver/README.md --->
