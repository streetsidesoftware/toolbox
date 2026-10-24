import assert from 'node:assert/strict';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT_DIR, REPOSITORY_GIT_URL } from './consts.ts';
import type { PackageJson } from './package-json-util.ts';
import { fixUpPackageJson, formatPackageJson } from './package-json-util.ts';

const pkgFile = (dir: string) => Path.join(REPO_ROOT_DIR, dir, 'package.json');

describe('fixUpPackageJson', () => {
  test('sets repository and public publishConfig for a published package', () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example' };
    fixUpPackageJson(pkg, pkgFile('packages/example'));
    assert.deepEqual(pkg.repository, { type: 'git', url: REPOSITORY_GIT_URL, directory: 'packages/example' });
    assert.deepEqual(pkg.publishConfig, { access: 'public', provenance: true });
  });

  test('restricts @internal packages and names unnamed ones after their directory', () => {
    const pkg: PackageJson = {};
    fixUpPackageJson(pkg, pkgFile('internal/helpers'));
    assert.equal(pkg.name, '@internal/helpers');
    assert.deepEqual(pkg.publishConfig, { access: 'restricted', provenance: true });
  });

  test('dedupes and sorts keywords', () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example', keywords: ['b', 'a', 'b'] };
    fixUpPackageJson(pkg, pkgFile('packages/example'));
    assert.deepEqual(pkg.keywords, ['a', 'b']);
  });
});

describe('formatPackageJson', () => {
  test('puts the leading fields first and ends with a newline', () => {
    const text = formatPackageJson({ version: '1.0.0', type: 'module', name: 'x', private: true });
    assert.deepEqual(Object.keys(JSON.parse(text)), ['name', 'version', 'private', 'type']);
    assert.ok(text.endsWith('}\n'));
  });
});
