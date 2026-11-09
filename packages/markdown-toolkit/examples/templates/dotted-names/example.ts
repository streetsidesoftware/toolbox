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
