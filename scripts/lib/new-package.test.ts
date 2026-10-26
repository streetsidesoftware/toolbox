import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, mock, test } from 'node:test';

import { hasPlaceholders } from '@streetsidesoftware/placeholders';

import { REPOSITORY_GIT_URL } from './consts.ts';
import {
  createPackage,
  newPackageFiles,
  privateDescription,
  TEMPLATE_DIR,
  validatePackageName,
} from './new-package.ts';

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

describe('privateDescription', () => {
  const DEFAULT = 'TODO: describe the package. -- Private until verified';

  test('appends the private suffix', () => {
    assert.equal(privateDescription('Does a.'), 'Does a. -- Private until verified');
  });

  test('does not add the suffix twice', () => {
    assert.equal(privateDescription('Does a. -- Private until verified'), 'Does a. -- Private until verified');
    assert.equal(privateDescription('Does a. -- Private until verified  '), 'Does a. -- Private until verified');
  });

  test('trims surrounding spaces', () => {
    assert.equal(privateDescription('  Does a.  '), 'Does a. -- Private until verified');
  });

  test('falls back to the default when missing or blank', () => {
    for (const description of [undefined, '', '   ', '-- Private until verified']) {
      assert.equal(privateDescription(description), DEFAULT, JSON.stringify(description));
    }
  });
});

describe('newPackageFiles', async () => {
  const files = await newPackageFiles('my-pkg', { year: 2030 });

  test('writes the package files', () => {
    assert.deepEqual(Object.keys(files).sort(), [
      'LICENSE',
      'README.md',
      'package.json',
      'src/index.test.ts',
      'src/index.ts',
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

  test('appends the private suffix to a given description, once', async () => {
    for (const description of ['Does a.', 'Does a. -- Private until verified']) {
      const pkg = JSON.parse(fileText(await newPackageFiles('a', { description }), 'package.json'));
      assert.equal(pkg.description, 'Does a. -- Private until verified');
    }
  });

  test('a blank description falls back to the default', async () => {
    for (const description of ['', '   ']) {
      const pkg = JSON.parse(fileText(await newPackageFiles('a', { description }), 'package.json'));
      assert.equal(pkg.description, 'TODO: describe the package. -- Private until verified');
    }
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

  test('a description with quotes and placeholders stays as given', async () => {
    const description = 'Says "hi" to {@ name @}.';
    const pkg = JSON.parse(fileText(await newPackageFiles('a', { description }), 'package.json'));
    assert.equal(pkg.description, 'Says "hi" to {@ name @}. -- Private until verified');
  });

  test('fills in every placeholder', () => {
    for (const [path, text] of Object.entries(files)) {
      assert.ok(!hasPlaceholders(path) && !hasPlaceholders(text), path);
    }
  });

  test('copies a file without placeholders as is', async () => {
    const template = await fs.readFile(Path.join(TEMPLATE_DIR, 'tsdown.config.ts'), 'utf-8');
    assert.equal(fileText(files, 'tsdown.config.ts'), template);
  });

  test('throws on an invalid name', async () => {
    await assert.rejects(newPackageFiles('Bad'), /Invalid package name/);
  });

  test('fills in placeholders in paths', async () => {
    await withTempRoot(async (templateDir) => {
      await fs.mkdir(Path.join(templateDir, 'src'));
      await fs.writeFile(Path.join(templateDir, 'src', '{@name@}.ts'), '{@ fullName @}');
      assert.deepEqual(await newPackageFiles('my-pkg', { templateDir }), {
        'src/my-pkg.ts': '@streetsidesoftware/my-pkg',
      });
    });
  });

  test('throws on a placeholder without a value, naming each one', async () => {
    await withTempRoot(async (templateDir) => {
      await fs.mkdir(Path.join(templateDir, 'src'));
      await fs.writeFile(Path.join(templateDir, 'src', '{@ title @}.ts'), '{@ name @} {@ author @} {@ author @}');
      await assert.rejects(newPackageFiles('a', { templateDir }), (error: Error) => {
        assert.equal(
          error.message,
          `Unknown placeholders in ${templateDir}:\n  src/{@ title @}.ts: {@ title @}\n  src/{@ title @}.ts: {@ author @}`,
        );
        return true;
      });
    });
  });
});

describe('createPackage', () => {
  test('writes packages/<name>/', async () => {
    await withTempRoot(async (rootDir) => {
      const dir = await createPackage('my-pkg', { rootDir });
      assert.equal(dir, Path.join(rootDir, 'packages', 'my-pkg'));
      const index = await fs.readFile(Path.join(dir, 'src', 'index.ts'), 'utf-8');
      assert.equal(index, "export const packageName = '@streetsidesoftware/my-pkg';\n");
    });
  });

  test('refuses an existing folder and leaves it untouched', async () => {
    await withTempRoot(async (rootDir) => {
      const dir = Path.join(rootDir, 'packages', 'my-pkg');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(Path.join(dir, 'keep.txt'), 'keep');
      await assert.rejects(createPackage('my-pkg', { rootDir }), /already exists/);
      assert.deepEqual(await fs.readdir(dir), ['keep.txt']);
    });
  });

  test('removes the folder if a write fails', async () => {
    await withTempRoot(async (rootDir) => {
      const writeFile = fs.writeFile;
      let calls = 0;
      const mocked = mock.method(fs, 'writeFile', (...args: Parameters<typeof fs.writeFile>) => {
        if (++calls === 3) return Promise.reject(new Error('disk full'));
        return writeFile(...args);
      });
      try {
        await assert.rejects(createPackage('my-pkg', { rootDir }), /disk full/);
      } finally {
        mocked.mock.restore();
      }
      assert.deepEqual(await fs.readdir(Path.join(rootDir, 'packages')), []);
    });
  });
});

function fileText(files: Record<string, string>, path: string): string {
  const text = files[path];
  assert.ok(text !== undefined, path);
  return text;
}

async function withTempRoot(fn: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'new-package-'));
  try {
    await fn(rootDir);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}
