import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { hasPublisher, parseJsonValues, recordTrusted, WORKFLOW_FILE } from './trusted-publishing.ts';

describe('trusted publishing helpers', () => {
  test('parseJsonValues splits concatenated JSON objects', () => {
    assert.deepEqual(parseJsonValues(''), []);
    assert.deepEqual(parseJsonValues('{"a":1}\n{"b":2}'), [{ a: 1 }, { b: 2 }]);
  });

  test('hasPublisher matches the repository and workflow', () => {
    const config = { type: 'github', repository: 'o/r', file: WORKFLOW_FILE };
    assert.equal(hasPublisher([config], 'o/r'), true);
    assert.equal(hasPublisher([{ ...config, file: 'other.yml' }], 'o/r'), false);
    assert.equal(hasPublisher([config], 'o/other'), false);
  });

  test('recordTrusted adds, removes, and sorts entries', () => {
    const added = recordTrusted({ '@s/b': { trustedPublishing: true } }, '@s/a', true);
    assert.deepEqual(Object.keys(added), ['@s/a', '@s/b']);
    assert.deepEqual(recordTrusted(added, '@s/a', false), { '@s/b': { trustedPublishing: true } });
  });
});
