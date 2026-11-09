### Dotted names

In an object of values, a dotted name such as `pkg.engines.node` can come from nested objects, from a top-level key
that holds the whole name, or from a mix of both. Each object below gives the same line its value, or leaves the
placeholder as written when it has none. The line is a plain string, which `substitutePlaceholders` also takes.

<!--- @@inject: example.ts --->

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

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
Requires Node >=20
Requires Node >=20
Requires Node >=20
Requires Node {@ pkg.engines.node @}
Requires Node >=22
Requires Node >=20
{@ toString @}
```

<!--- @@inject-end: output.md --->
