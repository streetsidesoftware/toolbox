import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { makePublic } from './publication.ts';

describe('makePublic', () => {
  test('removes private and the description suffix', () => {
    const pkg = { name: '@s/a', private: true, description: 'Does a thing. -- Private until verified' };
    assert.deepEqual(makePublic(pkg), { name: '@s/a', description: 'Does a thing.' });
  });

  test('leaves a description without the suffix alone', () => {
    assert.deepEqual(makePublic({ name: '@s/a', description: 'Does a thing.' }), {
      name: '@s/a',
      description: 'Does a thing.',
    });
  });
});
