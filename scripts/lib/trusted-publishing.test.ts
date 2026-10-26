import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  formatPublished,
  hasPublisher,
  parseJsonValues,
  prunePublished,
  recordPending,
  recordTrusted,
  WORKFLOW_FILE,
} from './trusted-publishing.ts';

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

  test('recordTrusted sets trustedPublishing, keeping false', () => {
    const published = recordTrusted({}, '@s/a', true);
    assert.deepEqual(published, { '@s/a': { trustedPublishing: true } });
    assert.deepEqual(recordTrusted(published, '@s/a', false), { '@s/a': { trustedPublishing: false } });
  });

  test('recordTrusted refuses a package marked never to publish', () => {
    assert.throws(() => recordTrusted({ '@s/a': false }, '@s/a', true), /never to be published/);
  });

  test('recordPending adds a waiting entry only when there is none', () => {
    assert.deepEqual(recordPending({}, '@s/a'), { '@s/a': { trustedPublishing: false } });
    const published = { '@s/a': false as const, '@s/b': { trustedPublishing: true } };
    assert.equal(recordPending(published, '@s/a'), published);
    assert.equal(recordPending(published, '@s/b'), published);
  });

  test('prunePublished drops packages not in the repo, keeping false', () => {
    const published = {
      '@s/a': { trustedPublishing: true },
      '@s/gone': { trustedPublishing: true },
      '@s/never': false as const,
    };
    assert.deepEqual(prunePublished(published, ['@s/a']), { '@s/a': { trustedPublishing: true }, '@s/never': false });
  });

  test('formatPublished writes one package per line, sorted by name', () => {
    const text = formatPublished({ '@s/b': { trustedPublishing: true }, '@s/a': false, '@s/c': {} });
    assert.equal(text, '{\n  "@s/a": false,\n  "@s/b": { "trustedPublishing": true },\n  "@s/c": {}\n}\n');
    assert.equal(formatPublished({}), '{}\n');
  });
});
