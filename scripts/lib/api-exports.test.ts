import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { firstParagraph, parseJsDoc, readApiFunctions, SUMMARY_LIMIT } from './api-exports.ts';
import type { ApiFunction } from './api-exports.ts';

describe('readApiFunctions', () => {
  test('reads each function through re-exports, with its parameters, summary and category', async () => {
    await withModules(
      {
        'index.ts': "export { codeBlock, heading } from './builders.ts';\n",
        'builders.ts': [
          '/**',
          ' * A heading, `## content`.',
          ' *',
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

  test('uses @summary instead of the first paragraph', async () => {
    await withFunction(['A first paragraph.', '@summary A summary', '  over two lines.', '@category C'], async (fn) => {
      assert.equal(fn.summary, 'A summary over two lines.');
    });
  });

  test('writes {@link name} as code and removes zero-width spaces', async () => {
    await withFunction(['A `{\u200B@ name @\u200B}` placeholder, see {@link list}.', '@category C'], async (fn) => {
      assert.equal(fn.summary, 'A `{@ name @}` placeholder, see `list`.');
    });
  });

  test('throws when there is no summary', async () => {
    await withFunction(['@category C'], async (_fn, error) => assert.match(String(error), /f in .* has no summary/));
    await withFunction(['- A list first.', '@category C'], async (_fn, error) => {
      assert.match(String(error), /f in .* has no summary/);
    });
  });

  test('throws on a summary over the limit, and on an inline tag other than {@link name}', async () => {
    await withFunction([`${'x'.repeat(SUMMARY_LIMIT)}.`, '@category C'], async (_fn, error) => {
      assert.match(String(error), /f in .* has a summary of 141 characters, over 140/);
    });
    await withFunction(['See {@linkcode g}.', '@category C'], async (_fn, error) => {
      assert.match(String(error), /unsupported inline tag in its summary: \{@linkcode g\}/);
    });
    await withFunction(['See {@link https://example.com | the site}.', '@category C'], async (_fn, error) => {
      assert.match(
        String(error),
        /unsupported inline tag in its summary: \{@link https:\/\/example\.com \| the site\}/,
      );
    });
  });

  test('throws on raw HTML in a summary, but not on HTML in code', async () => {
    await withFunction(['Wraps the text in <kbd> tags.', '@category C'], async (_fn, error) => {
      assert.match(String(error), /f in .* has raw HTML in its summary: <kbd>; put it in backticks/);
    });
    await withFunction(['A collapsible `<details>` block.', '@category C'], async (fn) => {
      assert.equal(fn.summary, 'A collapsible `<details>` block.');
    });
  });

  test('leaves out a this parameter', async () => {
    await withModules(
      { 'index.ts': '/**\n * F.\n * @category C\n */\nexport function f(this: Window, a: string): void {}\n' },
      async (index) => assert.deepEqual((await readApiFunctions(index))[0].params, ['a']),
    );
  });

  test('throws on a function exported as default', async () => {
    await withModules(
      { 'index.ts': '/**\n * F.\n * @category C\n */\nfunction f(): void {}\nexport { f as default, f };\n' },
      async (index) => assert.rejects(readApiFunctions(index), /export default isn't supported/),
    );
  });
});

describe('parseJsDoc', () => {
  test('returns the description and the tags, each tag on one line', () => {
    const jsdoc = '*\n * A summary.\n *\n * More.\n * @category Templates\n * @throws if the value\n *   is bad\n ';
    const { description, tags } = parseJsDoc(jsdoc);
    assert.equal(description, 'A summary.\n\nMore.');
    assert.deepEqual(
      [...tags],
      [
        ['category', 'Templates'],
        ['throws', 'if the value is bad'],
      ],
    );
  });

  test('reads a one-line JSDoc', () => {
    assert.equal(parseJsDoc('* Whether a value is Markdown. ').description, 'Whether a value is Markdown.');
  });
});

describe('firstParagraph', () => {
  test('joins the lines of the first paragraph', () => {
    assert.equal(firstParagraph('A long sentence\nthat wraps.\n\nMore.'), 'A long sentence that wraps.');
  });

  test('ends where a list starts', () => {
    assert.equal(firstParagraph('Plain text as paragraphs.\n- A blank line ends one.'), 'Plain text as paragraphs.');
  });

  test('is empty when the Markdown starts with something else', () => {
    assert.equal(firstParagraph('- A list.'), '');
    assert.equal(firstParagraph(''), '');
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

/** Read one function `f` with the given JSDoc lines, then call `fn` with it, or with the error reading it threw. */
async function withFunction(
  jsdoc: string[],
  fn: (api: ApiFunction, error?: unknown) => void | Promise<void>,
): Promise<void> {
  const source = ['/**', ...jsdoc.map((line) => ` * ${line}`), ' */', 'export function f(): void {}'];
  await withModules({ 'index.ts': source }, async (index) => {
    const result = await readApiFunctions(index).then(
      (functions) => ({ api: functions[0], error: undefined }),
      (error: unknown) => ({ api: undefined, error }),
    );
    if (result.api) await fn(result.api);
    else await fn({ name: '', params: [], summary: '', category: '', aliases: [] }, result.error);
  });
}
