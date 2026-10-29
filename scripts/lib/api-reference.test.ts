import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import type { ApiFunction } from './api-exports.ts';
import { CONFIG_FILE } from './api-reference-config.ts';
import {
  API_REFERENCE_MARKER,
  findApiReferencePackages,
  renderApiReference,
  updateApiReference,
} from './api-reference.ts';

describe('renderApiReference', () => {
  test('lists each group under its heading, one line per function, in the order given', () => {
    const groups = [
      {
        heading: 'Blocks',
        functions: [
          fn({ name: 'paragraph', params: ['...content'], aliases: ['p'], summary: 'A paragraph.' }),
          fn({ name: 'heading', params: ['depth', 'content'], summary: 'A heading, `## content`.' }),
        ],
      },
      {
        heading: 'Templates',
        functions: [fn({ name: 'template', params: ['markdown', 'values'], aliases: ['a', 'b'] })],
      },
    ];
    assert.equal(
      renderApiReference(groups),
      [
        '## Functions',
        '',
        '### Blocks',
        '',
        '- `paragraph(...content)` (also `p`): A paragraph.',
        '- `heading(depth, content)`: A heading, `## content`.',
        '',
        '### Templates',
        '',
        '- `template(markdown, values)` (also `a`, `b`): Summary.',
        '',
      ].join('\n'),
    );
  });

  test('keeps the summary as Markdown, block syntax and placeholders included', () => {
    const reference = renderApiReference([
      { heading: 'C', functions: [fn({ summary: '- A `{@ name @}` **placeholder**, kept as written.' })] },
    ]);
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
      const config = { groups: [{ heading: 'Greetings', categories: ['greetings'] }] };
      await fs.writeFile(Path.join(dir, 'packages/a', CONFIG_FILE), JSON.stringify(config));
      const source =
        '/**\n * Says hi.\n * @category greetings\n */\nexport function hi(name: string): string {\n  return name;\n}\n';
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

  test('throws when the package has no config', async () => {
    await withTempDir(async (dir) => {
      await writePackage(dir, 'packages/a', '');
      await assert.rejects(updateApiReference('packages/a', dir), /packages\/a\/\.api-referencerc\.json is missing/);
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
