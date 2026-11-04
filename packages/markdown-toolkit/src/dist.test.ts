import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('the built types import nothing', async () => {
  const types = await readFile(new URL('../dist/index.d.ts', import.meta.url), 'utf8');
  const imports = types.match(/^(?:import|export)\b.*\bfrom\s+["'].*$|^import\s+["'].*$|\bimport\(["'][^"']*["']\)/gm);
  assert.deepEqual(imports ?? [], []);
});
