import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { WorkspacePackage } from './packages.ts';
import { makePublic, publicationCandidates } from './publication.ts';

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

describe('publicationCandidates', () => {
  const pkg = (dir: string, name: string, isPrivate: boolean): WorkspacePackage => ({
    dir: `packages/${dir}`,
    packageJson: { name, ...(isPrivate && { private: true }) },
  });
  const packages = [pkg('a', '@s/a', true), pkg('b', '@s/b', false), pkg('c', '@s/c', true), pkg('d', '@s/d', true)];

  test('lists private packages unless published.json marks them false', () => {
    const published = { '@s/a': { trustedPublishing: false }, '@s/c': false as const };
    assert.deepEqual(publicationCandidates(packages, published), [
      { dir: 'a', name: '@s/a' },
      { dir: 'd', name: '@s/d' },
    ]);
  });
});
