import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { sep } from 'node:path';
import { test } from 'node:test';

/** The packages that parse, write or walk Markdown trees. */
const treePackage = /^(?:mdast|mdast-util-.+|micromark.*|remark|remark-.+|unified|unist|unist-util-.+)$/;

test('only core/ imports the Markdown tree packages', async () => {
  const importing: string[] = [];
  for (const [file, source] of await sourcesOutsideCore()) {
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?['"]([^'"]+)['"]/g)];
    if (specifiers.some(([, from, imported]) => treePackage.test(from ?? imported))) importing.push(file);
  }
  assert.deepEqual(importing, []);
});

test('only core/ writes node literals', async () => {
  // A node literal needs no import, since the parameter it's passed to gives it its type.
  // The `type` fields in `types.ts` name this package's own element types, not nodes.
  const writing = (await sourcesOutsideCore())
    .filter(([file, source]) => file !== 'types.ts' && /\btype:\s*['"]/.test(source))
    .map(([file]) => file);
  assert.deepEqual(writing, []);
});

/** Return each source file outside `core/`, tests left out, as its path from `src/` and its text. */
async function sourcesOutsideCore(): Promise<[file: string, source: string][]> {
  const src = new URL('./', import.meta.url);
  const files = (await readdir(src, { recursive: true }))
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('.ts') && !/\.test(?:Helper)?\.ts$/.test(file) && !file.startsWith('core/'))
    .sort();
  return Promise.all(
    files.map(async (file): Promise<[string, string]> => [file, await readFile(new URL(file, src), 'utf8')]),
  );
}
