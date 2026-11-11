import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { sep } from 'node:path';
import { test } from 'node:test';

/** The packages that parse, write or walk Markdown trees. */
const treePackage = /^(?:mdast|mdast-util-.+|micromark.*|remark|remark-.+|unified|unist|unist-util-.+)$/;

/** The files outside `core/` that still import a tree package. Each one leaves the list when its tree code moves into `core/`. */
const notMovedYet = [
  'builder/comment.ts',
  'builder/document.ts',
  'builder/formatting.ts',
  'builder/frontmatter.ts',
  'builder/htmlBlocks.ts',
  'builder/list.ts',
  'builder/table.ts',
  'builder/text.ts',
  'detectStyle.ts',
  'element/content.ts',
  'element/element.ts',
  'render.ts',
  'template/fragment.ts',
  'template/parse.ts',
  'template/replacements.ts',
  'template/substitute.ts',
];

test('only core/ imports the Markdown tree packages', async () => {
  const src = new URL('./', import.meta.url);
  const files = (await readdir(src, { recursive: true }))
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('.ts') && !/\.test(?:Helper)?\.ts$/.test(file) && !file.startsWith('core/'))
    .sort();
  const importing: string[] = [];
  for (const file of files) {
    const source = await readFile(new URL(file, src), 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?['"]([^'"]+)['"]/g)];
    if (specifiers.some(([, from, imported]) => treePackage.test(from ?? imported))) importing.push(file);
  }
  assert.deepEqual(importing, notMovedYet);
});
