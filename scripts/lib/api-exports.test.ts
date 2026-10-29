import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { parseJsDoc, readApiFunctions } from './api-exports.ts';
import { REPO_ROOT_DIR } from './consts.ts';

describe('readApiFunctions', () => {
  test('reads each function through re-exports, with its parameters, summary and category', async () => {
    await withModules(
      {
        'index.ts': "export { codeBlock, heading } from './builders.ts';\n",
        'builders.ts': [
          '/**',
          ' * A heading, `## content`.',
          ' * More detail.',
          ' * @category Blocks',
          ' */',
          'export function heading(depth: number, content: string): string {',
          '  return content;',
          '}',
          '',
          '/**',
          ' * A fenced code block, unlike {@link heading}.',
          ' * @category Blocks',
          ' */',
          "export function codeBlock(code: string, lang?: string, fence = '`', ...rest: string[]): string {",
          '  return code;',
          '}',
        ],
      },
      async (index) => {
        assert.deepEqual(await readApiFunctions(index), [
          {
            name: 'codeBlock',
            params: ['code', 'lang?', 'fence?', '...rest'],
            summary: 'A fenced code block, unlike `heading`.',
            category: 'Blocks',
            aliases: [],
          },
          {
            name: 'heading',
            params: ['depth', 'content'],
            summary: 'A heading, `## content`.',
            category: 'Blocks',
            aliases: [],
          },
        ]);
      },
    );
  });

  test('lists a const that names a function, and a renamed export, as aliases of the declared name', async () => {
    await withModules(
      {
        'index.ts': "export { p, paragraph, parse as parseFragment, parse } from './a.ts';\n",
        'a.ts': [
          '/**',
          ' * A paragraph.',
          ' * @category Blocks',
          ' */',
          'export function paragraph(...content: string[]): string {',
          "  return content.join('');",
          '}',
          '',
          '/** The same as {@link paragraph}. */',
          'export const p: typeof paragraph = paragraph;',
          '',
          '/**',
          ' * Markdown text as an element.',
          ' * @category Parsing',
          ' */',
          'export function parse(markdown: string): string {',
          '  return markdown;',
          '}',
        ],
      },
      async (index) => {
        const functions = await readApiFunctions(index);
        assert.deepEqual(
          functions.map(({ name, aliases }) => ({ name, aliases })),
          [
            { name: 'paragraph', aliases: ['p'] },
            { name: 'parse', aliases: ['parseFragment'] },
          ],
        );
      },
    );
  });

  test('uses the first exported name when the declared one is not exported', async () => {
    await withModules(
      {
        'index.ts': "export { f as g, f as h } from './a.ts';\n",
        'a.ts': '/**\n * F.\n * @category C\n */\nexport function f(): void {}\n',
      },
      async (index) => {
        const [fn] = await readApiFunctions(index);
        assert.deepEqual([fn.name, fn.aliases], ['g', ['h']]);
      },
    );
  });

  test('takes the JSDoc from the first overload and the parameters from the implementation', async () => {
    await withModules(
      {
        'index.ts': [
          '/**',
          ' * A whole document.',
          ' * @category Documents',
          ' */',
          'export function document(first: number, ...content: string[]): string;',
          'export function document(...content: string[]): string;',
          'export function document(...parts: unknown[]): string {',
          "  return '';",
          '}',
        ],
      },
      async (index) => {
        const [fn] = await readApiFunctions(index);
        assert.deepEqual([fn.params, fn.summary], [['...parts'], 'A whole document.']);
      },
    );
  });

  test('ignores export * and export default in a module it only re-exports from', async () => {
    await withModules(
      {
        'index.ts': "export { f } from './a.ts';\n",
        'a.ts':
          "export * from './b.ts';\nexport default 1;\n/**\n * F.\n * @category C\n */\nexport function f(): void {}\n",
      },
      async (index) => {
        assert.deepEqual(
          (await readApiFunctions(index)).map((fn) => fn.name),
          ['f'],
        );
      },
    );
  });

  test('skips type exports', async () => {
    await withModules(
      {
        'index.ts': [
          "export type { A } from './a.ts';",
          "export { type B, f } from './a.ts';",
          'export interface C {}',
          'export type D = string;',
        ],
        'a.ts': [
          'export type A = string;',
          'export type B = number;',
          '/**',
          ' * F.',
          ' * @category C',
          ' */',
          'export function f(): void {}',
        ],
      },
      async (index) => {
        assert.deepEqual(
          (await readApiFunctions(index)).map((fn) => fn.name),
          ['f'],
        );
      },
    );
  });

  test('throws when a function has no @category or no JSDoc', async () => {
    await withModules({ 'index.ts': '/** F. */\nexport function f(): void {}\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /f in .*index\.ts has no @category/);
    });
    await withModules({ 'index.ts': '// F.\nexport function f(): void {}\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /f in .*index\.ts has no JSDoc/);
    });
  });

  test('throws on a value export that is not a function, and on export *', async () => {
    await withModules({ 'index.ts': 'export const answer = 42;\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /answer in .*index\.ts isn't a function/);
    });
    await withModules({ 'index.ts': 'export const { a, b: [c] } = { a: 1, b: [2] };\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /a in .*index\.ts isn't a function/);
    });
    await withModules({ 'index.ts': 'export class A {}\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /A in .*index\.ts isn't a function/);
    });
    await withModules({ 'index.ts': "export * from './a.ts';\n", 'a.ts': '' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /export \* isn't supported/);
    });
    await withModules({ 'index.ts': 'export default 1;\n' }, async (index) => {
      await assert.rejects(readApiFunctions(index), /export default isn't supported/);
    });
  });

  test('reads every function markdown-toolkit exports', async () => {
    const functions = await readApiFunctions(Path.join(REPO_ROOT_DIR, 'packages/markdown-toolkit/src/index.ts'));
    const paragraph = functions.find((fn) => fn.name === 'paragraph');
    assert.deepEqual(paragraph?.aliases, ['p']);
    assert.ok(functions.every((fn) => fn.summary && fn.category));
  });
});

describe('parseJsDoc', () => {
  test('returns the first line as the summary, and the tags', () => {
    const jsdoc =
      '*\n * A `{​@ name @​}` placeholder, see {@link list | lists}.\n * More.\n * @category Templates\n * @throws if bad\n ';
    const { summary, tags } = parseJsDoc(jsdoc);
    assert.equal(summary, 'A `{@ name @}` placeholder, see `list`.');
    assert.deepEqual(
      [...tags],
      [
        ['category', 'Templates'],
        ['throws', 'if bad'],
      ],
    );
  });

  test('reads a one-line JSDoc', () => {
    assert.deepEqual(parseJsDoc('* Whether a value is Markdown. ').summary, 'Whether a value is Markdown.');
  });
});

async function withModules(files: Record<string, string | string[]>, fn: (index: string) => Promise<void>) {
  const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'api-exports-'));
  try {
    for (const [name, lines] of Object.entries(files)) {
      await fs.writeFile(Path.join(dir, name), Array.isArray(lines) ? lines.join('\n') + '\n' : lines);
    }
    await fn(Path.join(dir, 'index.ts'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
