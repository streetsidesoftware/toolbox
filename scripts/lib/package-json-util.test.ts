import assert from 'node:assert/strict';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { REPO_ROOT_DIR, REPOSITORY_GIT_URL } from './consts.ts';
import type { PackageJson } from './package-json-util.ts';
import { fixUpPackageJson, fixUpTemplatePackageJson, formatPackageJson } from './package-json-util.ts';

const pkgFile = (dir: string) => Path.join(REPO_ROOT_DIR, dir, 'package.json');
const root: PackageJson = { engines: { node: '>=22.18.0' } };

describe('fixUpPackageJson', () => {
  test('sets repository and public publishConfig for a published package', () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example' };
    fixUpPackageJson(pkg, pkgFile('packages/example'), root);
    assert.deepEqual(pkg.repository, { type: 'git', url: REPOSITORY_GIT_URL, directory: 'packages/example' });
    assert.deepEqual(pkg.publishConfig, { access: 'public', provenance: true });
  });

  test('restricts @internal packages and names unnamed ones after their directory', () => {
    const pkg: PackageJson = {};
    fixUpPackageJson(pkg, pkgFile('internal/helpers'), root);
    assert.equal(pkg.name, '@internal/helpers');
    assert.deepEqual(pkg.publishConfig, { access: 'restricted', provenance: true });
  });

  test('dedupes and sorts keywords', () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example', keywords: ['b', 'a', 'b'] };
    fixUpPackageJson(pkg, pkgFile('packages/example'), root);
    assert.deepEqual(pkg.keywords, ['a', 'b']);
  });

  test("sets engines.node from the root's, keeping other engines", () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example', engines: { node: '>=20', vscode: '^1.90.0' } };
    fixUpPackageJson(pkg, pkgFile('packages/example'), root);
    assert.deepEqual(pkg.engines, { node: '>=22.18.0', vscode: '^1.90.0' });
  });

  test('adds engines when the package has none', () => {
    const pkg: PackageJson = { name: '@streetsidesoftware/example' };
    fixUpPackageJson(pkg, pkgFile('packages/example'), root);
    assert.deepEqual(pkg.engines, { node: '>=22.18.0' });
  });

  test('throws when the root has no engines.node', () => {
    assert.throws(() => fixUpPackageJson({}, pkgFile('packages/example'), {}), /has no engines\.node/);
  });
});

describe('fixUpTemplatePackageJson', () => {
  test('sets engines.node and sorts keywords, but leaves name, repository and publishConfig alone', () => {
    const pkg: PackageJson = { name: '{@ fullName @}', keywords: ['b', 'a'], engines: { node: '>=20' } };
    fixUpTemplatePackageJson(pkg, root);
    assert.deepEqual(pkg, { name: '{@ fullName @}', keywords: ['a', 'b'], engines: { node: '>=22.18.0' } });
  });
});

describe('formatPackageJson', () => {
  test('puts the leading fields first and ends with a newline', () => {
    const text = formatPackageJson({ version: '1.0.0', type: 'module', name: 'x', private: true });
    assert.deepEqual(Object.keys(JSON.parse(text)), ['name', 'version', 'private', 'type']);
    assert.ok(text.endsWith('}\n'));
  });
});
