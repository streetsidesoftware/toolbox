import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { packageName } from './index.ts';

describe('packageName', () => {
  test('is the package name', () => {
    assert.equal(packageName, '{@ fullName @}');
  });
});
