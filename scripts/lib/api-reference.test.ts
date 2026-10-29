import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import type { ApiFunction } from './api-exports.ts';
import {
  API_REFERENCE_MARKER,
  findApiReferencePackages,
  renderApiReference,
  updateApiReference,
} from './api-reference.ts';

describe('renderApiReference', () => {
  test('lists the functions under a heading per category, both in alphabetical order', () => {
    const functions: ApiFunction[] = [
      fn({ name: 'paragraph', params: ['...content'], category: 'Blocks', aliases: ['p'], summary: 'A paragraph.' }),
      fn({ name: 'template', params: ['markdown', 'values'], category: 'Templates', aliases: ['a', 'b'] }),
      fn({ name: 'heading', params: ['depth', 'content'], category: 'Blocks', summary: 'A heading, `## content`.' }),
    ];
    assert.equal(
      renderApiReference(functions),
      [
        '## Functions',
        '',
        '### Blocks',
        '',
        '- `heading(depth, content)`: A heading, `## content`.',
        '- `paragraph(...content)` (also `p`): A paragraph.',
        '',
        '### Templates',
        '',
        '- `template(markdown, values)` (also `a`, `b`): Summary.',
        '',
      ].join('\n'),
    );
  });

  test('keeps the summary as Markdown, block syntax and placeholders included', () => {
    const reference = renderApiReference([fn({ summary: '- A `{@ name @}` **placeholder**, kept as written.' })]);
    assert.equal(reference, '## Functions\n\n### C\n\n- `f()`: - A `{@ name @}` **placeholder**, kept as written.\n');
  });
});

describe('findApiReferencePackages', () => {
  test('finds each package whose README injects the reference in its own folder', async () => {
    await withTempDir(async (dir) => {
      await writePackage(dir, 'packages/a', `# a\n\n${API_REFERENCE_MARKER}\n`);
      await writePackage(dir, 'packages/b', '# b\n');
      await writePackage(dir, 'packages/c', '# c\n\n<!--- @@inject: ../../static/api-reference.md --->\n');
      assert.deepEqual(await findApiReferencePackages(dir), ['packages/a']);
    });
  });
});

describe('updateApiReference', () => {
  test('writes the reference of a package, only when it changed', async () => {
    await withTempDir(async (dir) => {
      await writePackage(dir, 'packages/a', '');
      const source =
        '/**\n * Says hi.\n * @category Greetings\n */\nexport function hi(name: string): string {\n  return name;\n}\n';
      await fs.mkdir(Path.join(dir, 'packages/a/src'));
      await fs.writeFile(Path.join(dir, 'packages/a/src/index.ts'), source);
      assert.equal(await updateApiReference('packages/a', dir), true);
      assert.equal(
        await fs.readFile(Path.join(dir, 'packages/a/static/api-reference.md'), 'utf8'),
        '## Functions\n\n### Greetings\n\n- `hi(name)`: Says hi.\n',
      );
      assert.equal(await updateApiReference('packages/a', dir), false);
    });
  });
});

function fn(fields: Partial<ApiFunction>): ApiFunction {
  return { name: 'f', params: [], summary: 'Summary.', category: 'C', aliases: [], ...fields };
}

async function writePackage(dir: string, packageDir: string, readme: string): Promise<void> {
  await fs.mkdir(Path.join(dir, packageDir), { recursive: true });
  await fs.writeFile(Path.join(dir, packageDir, 'package.json'), JSON.stringify({ name: Path.basename(packageDir) }));
  await fs.writeFile(Path.join(dir, packageDir, 'README.md'), readme);
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'api-reference-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
