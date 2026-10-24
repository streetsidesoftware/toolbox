import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { WorkspacePackage } from './packages.ts';
import { packagesCsv } from './readme.ts';

const pkg = (dir: string, name: string, description: string, isPrivate = false): WorkspacePackage => ({
  dir,
  packageJson: { name, description, ...(isPrivate && { private: true }) },
});

describe('packagesCsv', () => {
  test('lists published packages sorted by name, linked relative to static/', () => {
    const csv = packagesCsv([pkg('packages/b', '@s/b', 'Bee.'), pkg('packages/a', '@s/a', 'Ay.')]);
    assert.equal(csv, 'Package,Description\n[`@s/a`](../packages/a),Ay.\n[`@s/b`](../packages/b),Bee.\n');
  });

  test('leaves out private packages', () => {
    const csv = packagesCsv([pkg('packages/a', '@s/a', 'Ay. -- Private until verified', true)]);
    assert.equal(csv, 'Package,Description\n');
  });

  test('quotes commas and quotes, and escapes pipes', () => {
    const csv = packagesCsv([pkg('packages/a', '@s/a', 'Say "hi", or a|b.')]);
    assert.equal(csv, 'Package,Description\n[`@s/a`](../packages/a),"Say ""hi"", or a\\|b."\n');
  });
});
