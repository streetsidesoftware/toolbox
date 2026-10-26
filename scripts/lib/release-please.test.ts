import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { WorkspacePackage } from './packages.ts';
import type { ReleasePleaseConfig } from './release-please.ts';
import { applyReleaseAs, CONFIG_SETTINGS, genConfig, genManifest } from './release-please.ts';

const root: WorkspacePackage = { dir: '.', packageJson: { name: 'toolbox', version: '0.0.0', private: true } };
const pkgA: WorkspacePackage = { dir: 'packages/a', packageJson: { name: '@s/a', version: '1.2.0' } };
const pkgB: WorkspacePackage = {
  dir: 'packages/b',
  packageJson: { name: '@s/b', version: '0.0.1-alpha.0', private: true },
};

describe('genManifest', () => {
  test('seeds missing packages at their package.json version, private ones included', () => {
    assert.deepEqual(genManifest(root, [pkgA, pkgB], {}), {
      '.': '0.0.0',
      'packages/a': '1.2.0',
      'packages/b': '0.0.1-alpha.0',
    });
  });

  test('never changes an existing entry', () => {
    const manifest = genManifest(root, [pkgA], { '.': '3.0.0', 'packages/a': '1.5.0' });
    assert.deepEqual(manifest, { '.': '3.0.0', 'packages/a': '1.5.0' });
  });

  test('drops entries for packages that no longer exist', () => {
    assert.deepEqual(genManifest(root, [], { '.': '1.0.0', 'packages/gone': '2.0.0' }), { '.': '1.0.0' });
  });
});

describe('genConfig', () => {
  test('has an entry for the root and every package, with the shared settings', () => {
    const config = genConfig(root, [pkgA, pkgB], undefined, {});
    assert.deepEqual(config, {
      ...CONFIG_SETTINGS,
      packages: {
        '.': { component: 'toolbox' },
        'packages/a': { component: '@s/a' },
        'packages/b': { component: '@s/b' },
      },
    });
  });

  test('keeps release-as until the manifest shows that version', () => {
    const current: ReleasePleaseConfig = {
      packages: { 'packages/b': { component: '@s/b', 'release-as': '1.0.0' } },
    };
    const pending = genConfig(root, [pkgB], current, { 'packages/b': '0.0.1-alpha.0' });
    assert.equal(pending.packages['packages/b']?.['release-as'], '1.0.0');

    const released = genConfig(root, [pkgB], current, { 'packages/b': '1.0.0' });
    assert.deepEqual(released.packages['packages/b'], { component: '@s/b' });
  });

  test('drops entries for packages that no longer exist', () => {
    const current: ReleasePleaseConfig = { packages: { 'packages/gone': { component: '@s/gone' } } };
    assert.deepEqual(Object.keys(genConfig(root, [], current, {}).packages), ['.']);
  });
});

describe('applyReleaseAs', () => {
  const config: ReleasePleaseConfig = {
    ...CONFIG_SETTINGS,
    packages: { 'packages/a': { component: '@s/a' }, 'packages/b': { component: '@s/b', 'release-as': '1.0.0' } },
  };

  test('sets release-as on the named packages only', () => {
    const result = applyReleaseAs(config, ['@s/a'], '2.0.0-alpha.0');
    assert.deepEqual(result.packages['packages/a'], { component: '@s/a', 'release-as': '2.0.0-alpha.0' });
    assert.deepEqual(result.packages['packages/b'], config.packages['packages/b']);
  });

  test('removes release-as', () => {
    const result = applyReleaseAs(config, ['@s/b'], undefined);
    assert.deepEqual(result.packages['packages/b'], { component: '@s/b' });
  });

  test('throws for a package not in the config', () => {
    assert.throws(() => applyReleaseAs(config, ['@s/missing'], '1.0.0'), /@s\/missing/);
  });
});
