import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import { REPOSITORY_GIT_URL } from './consts.ts';
import { createPackage, newPackageFiles, validatePackageName } from './new-package.ts';

describe('validatePackageName', () => {
  test('accepts lowercase hyphenated names', () => {
    for (const name of ['a', 'unindent', 'test-each', 'v2-utils']) validatePackageName(name);
  });

  test('rejects anything else', () => {
    for (const name of ['', 'Test', '2fast', 'a--b', '-a', 'a-', 'a_b', 'a.b', '@streetsidesoftware/a', '../a']) {
      assert.throws(() => validatePackageName(name), /Invalid package name/, name);
    }
  });
});

describe('newPackageFiles', () => {
  const files = newPackageFiles('my-pkg', { year: 2030 });

  test('writes the package files', () => {
    assert.deepEqual(Object.keys(files).sort(), [
      'LICENSE',
      'README.md',
      'package.json',
      'src/index.ts',
      'src/my-pkg.test.ts',
      'tsconfig.json',
      'tsdown.config.ts',
    ]);
  });

  test('package.json is private at 0.0.1-alpha.0, with lint fields already set', () => {
    const pkg = JSON.parse(fileText(files, 'package.json'));
    assert.equal(pkg.name, '@streetsidesoftware/my-pkg');
    assert.equal(pkg.version, '0.0.1-alpha.0');
    assert.equal(pkg.private, true);
    assert.equal(pkg.description, 'TODO: describe the package. -- Private until verified');
    assert.deepEqual(pkg.files, ['dist', '!dist/**/*.map']);
    assert.deepEqual(pkg.repository, { type: 'git', url: REPOSITORY_GIT_URL, directory: 'packages/my-pkg' });
    assert.deepEqual(pkg.publishConfig, { access: 'public', provenance: true });
    assert.deepEqual(Object.keys(pkg).slice(0, 4), ['name', 'version', 'private', 'description']);
  });

  test('appends the private suffix to a given description', () => {
    const pkg = JSON.parse(fileText(newPackageFiles('a', { description: 'Does a.' }), 'package.json'));
    assert.equal(pkg.description, 'Does a. -- Private until verified');
  });

  test('README leaves the inject markers empty', () => {
    const readme = fileText(files, 'README.md');
    assert.match(readme, /^# @streetsidesoftware\/my-pkg\n/);
    assert.match(readme, /## Install\n/);
    for (const file of ['sponsor.md', 'footer.md']) {
      const start = `<!--- @@inject: ../../static/${file} --->`;
      const end = `<!--- @@inject-end: ../../static/${file} --->`;
      assert.ok(readme.includes(`${start}\n\n${end}\n`), file);
    }
  });

  test('LICENSE has the year', () => {
    assert.match(fileText(files, 'LICENSE'), /^MIT License\n\nCopyright \(c\) 2030 Street Side Software\n/);
  });

  test('throws on an invalid name', () => {
    assert.throws(() => newPackageFiles('Bad'), /Invalid package name/);
  });
});

describe('createPackage', () => {
  test('writes packages/<name>/ and refuses an existing folder', async () => {
    const rootDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'new-package-'));
    try {
      const dir = await createPackage('my-pkg', { rootDir });
      assert.equal(dir, Path.join(rootDir, 'packages', 'my-pkg'));
      const index = await fs.readFile(Path.join(dir, 'src', 'index.ts'), 'utf-8');
      assert.equal(index, "export const packageName = '@streetsidesoftware/my-pkg';\n");
      await assert.rejects(createPackage('my-pkg', { rootDir }), /already exists/);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

function fileText(files: Record<string, string>, path: string): string {
  const text = files[path];
  assert.ok(text !== undefined, path);
  return text;
}
