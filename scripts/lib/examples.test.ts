import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { findExamples, OUTPUT_FILE, runExample, updateExampleOutput } from './examples.ts';

describe('findExamples', () => {
  test('finds each example folder of each package, nested ones included, sorted', async () => {
    await withTempDir(async (dir) => {
      await writeExample(dir, 'packages/b/examples/one', 'console.log(1);\n');
      await writeExample(dir, 'packages/a/examples/two', 'console.log(2);\n');
      await writeExample(dir, 'packages/a/examples/one', 'console.log(3);\n');
      await writeExample(dir, 'packages/a/examples/part/three', 'console.log(5);\n');
      await writeExample(dir, 'packages/a/src', 'console.log(4);\n');
      assert.deepEqual(await findExamples(dir), [
        'packages/a/examples/one/example.ts',
        'packages/a/examples/part/three/example.ts',
        'packages/a/examples/two/example.ts',
        'packages/b/examples/one/example.ts',
      ]);
    });
  });
});

describe('runExample', () => {
  test('returns what it prints, run in its own folder', async () => {
    await withTempDir(async (dir) => {
      const code =
        "import fs from 'node:fs';\nconst n: number = 2;\nconsole.log(fs.readFileSync('data.txt', 'utf8') + n);\n";
      const file = await writeExample(dir, 'ex', code);
      await fs.writeFile(Path.join(dir, 'ex', 'data.txt'), 'a');
      assert.equal(await runExample(file), 'a2\n');
    });
  });

  test('throws when the example fails', async () => {
    await withTempDir(async (dir) => {
      const file = await writeExample(dir, 'ex', "throw new Error('broken');\n");
      await assert.rejects(runExample(file), /broken/);
    });
  });
});

describe('updateExampleOutput', () => {
  test('writes the output next to the example, only when it changed', async () => {
    await withTempDir(async (dir) => {
      const file = await writeExample(dir, 'ex', "console.log('# Hi');\n");
      const outputFile = Path.join(dir, 'ex', OUTPUT_FILE);
      assert.equal(await updateExampleOutput(file), true);
      assert.equal(await fs.readFile(outputFile, 'utf8'), '# Hi\n');
      assert.equal(await updateExampleOutput(file), false);
    });
  });

  test('writes no output file for an example that prints nothing', async () => {
    await withTempDir(async (dir) => {
      const file = await writeExample(dir, 'ex', 'const n = 1;\n');
      assert.equal(await updateExampleOutput(file), false);
      await assert.rejects(fs.access(Path.join(dir, 'ex', OUTPUT_FILE)));
    });
  });

  test('removes the output file once the example prints nothing', async () => {
    await withTempDir(async (dir) => {
      const file = await writeExample(dir, 'ex', 'const n = 1;\n');
      const outputFile = Path.join(dir, 'ex', OUTPUT_FILE);
      await fs.writeFile(outputFile, '# Hi\n');
      assert.equal(await updateExampleOutput(file), true);
      await assert.rejects(fs.access(outputFile));
    });
  });
});

async function writeExample(dir: string, folder: string, code: string): Promise<string> {
  const file = Path.join(dir, folder, 'example.ts');
  await fs.mkdir(Path.dirname(file), { recursive: true });
  await fs.writeFile(file, code);
  return file;
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'examples-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
