## Templates

A template is Markdown with `{@ name @}` placeholders. It suits a page that is mostly fixed text, with data in a few
places.

<!--- @@inject: placeholders/README.md --->

### Placeholders

Each `{@ name @}` takes the value of the same name. A string goes in as text, and an element as Markdown. A
placeholder on a line of its own also takes blocks, such as a list or a table. A dotted name, such as
`{@ pkg.name @}`, looks up a nested object, and a placeholder works inside code too.

Use `inlineTemplate` for a template that goes inside a line, and `blockTemplate` for one that must be blocks.

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

<!--- @@inject-end: placeholders/README.md --->

<!--- @@inject: existing-markdown/README.md --->

### Markdown from elsewhere

A string is always text. For a string that is already Markdown, such as a description from another file, pass
`parse(text)` instead. Like a template, it gives inline content or blocks, and `toBlock` makes either fit where
only blocks can go.

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

<!--- @@inject-end: existing-markdown/README.md --->

<!--- @@inject: in-steps/README.md --->

### Build a page in steps

Several steps can each substitute what they know. Pass the result of one step to `substitutePlaceholders` to
substitute more of its placeholders. A placeholder with no value yet is kept as written, so a later step, or a tool
such as [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), can substitute it. In code,
`placeholder(name)` leaves the same gap inside a line, and `blockPlaceholder(name)` on lines of its own.

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

<!--- @@inject-end: in-steps/README.md --->

<!--- @@inject: dotted-names/README.md --->

### Dotted names

In an object of values, a dotted name such as `pkg.engines.node` can come from nested objects, from a top-level key
that holds the whole name, or from a mix of both. Each object below gives the same line its value, or leaves the
placeholder as written when it has none. The line is a plain string, which `substitutePlaceholders` also takes.

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const line = 'Requires Node {@ pkg.engines.node @}';

// Nested objects, one part of the name at each level.
show({ pkg: { engines: { node: '>=20' } } });

// A top-level key that holds the whole name.
show({ 'pkg.engines.node': '>=20' });

// A top-level key that holds the leading part of the name.
show({ 'pkg.engines': { node: '>=20' } });

// A key in a nested object is never split at its dot.
show({ pkg: { 'engines.node': '>=20' } });

// When two keys supply the name, the later one wins.
show({
  'pkg.engines.node': '>=20',
  pkg: { engines: { node: '>=22' } },
});

// A key set to undefined supplies nothing.
show({
  pkg: { engines: { node: '>=20' } },
  'pkg.engines.node': undefined,
});

// Only the object's own keys count.
const kept = md.substitutePlaceholders('{@ toString @}', {});
console.log(kept.toString());

function show(values: md.TemplateValues) {
  console.log(md.substitutePlaceholders(line, values).toString());
}
```

```markdown
Requires Node >=20
Requires Node >=20
Requires Node >=20
Requires Node {@ pkg.engines.node @}
Requires Node >=22
Requires Node >=20
{@ toString @}
```

<!--- @@inject-end: dotted-names/README.md --->

<!--- @@inject: resolver/README.md --->

### Values from a function

In place of an object, pass a function that takes a placeholder name and returns its value. It gets the whole name,
such as `dictionaries.custom`, not one part at a time. Values can then come from a `Map`, a config file or anywhere
else. When it returns
`undefined`, the placeholder is kept for a later step.

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

<!--- @@inject-end: resolver/README.md --->
