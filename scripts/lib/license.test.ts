import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { syncLicense } from './license.ts';

describe('syncLicense', () => {
  test('writes a missing or different LICENSE', async () => {
    await withTempDir(async (dir) => {
      const file = Path.join(dir, 'LICENSE');
      assert.equal(await syncLicense(file, 'MIT\n'), true);
      assert.equal(await fs.readFile(file, 'utf-8'), 'MIT\n');
      await fs.writeFile(file, 'old\n');
      assert.equal(await syncLicense(file, 'MIT\n'), true);
      assert.equal(await fs.readFile(file, 'utf-8'), 'MIT\n');
    });
  });

  test('leaves a matching LICENSE alone', async () => {
    await withTempDir(async (dir) => {
      const file = Path.join(dir, 'LICENSE');
      await fs.writeFile(file, 'MIT\n');
      assert.equal(await syncLicense(file, 'MIT\n'), false);
    });
  });

  test('only reports in a dry run', async () => {
    await withTempDir(async (dir) => {
      const file = Path.join(dir, 'LICENSE');
      await fs.writeFile(file, 'old\n');
      assert.equal(await syncLicense(file, 'MIT\n', { dryRun: true }), true);
      assert.equal(await fs.readFile(file, 'utf-8'), 'old\n');
    });
  });
});

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'license-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
