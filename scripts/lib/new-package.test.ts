import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, mock, test } from 'node:test';

import { hasPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';

import { REPOSITORY_GIT_URL, ROOT_LICENSE_FILE, TEMPLATE_DIR } from './consts.ts';
import { createPackage, newPackageFiles, privateDescription, validatePackageName } from './new-package.ts';
import type { NewPackageOptions } from './new-package.ts';
import type { PackageJson } from './package-json-util.ts';
import { readPackageJson, ROOT_PACKAGE_JSON_FILE } from './package-json-util.ts';

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
  // These run on the real templates without depending on what they say, so editing a template doesn't break them.
  describe('with static/templates', async () => {
    const templates = await readTemplateFiles(TEMPLATE_DIR);
    const files = await newPackageFiles('my-pkg');

    test('writes one file per template, with placeholders in its path substituted, and LICENSE', () => {
      const expected = Object.keys(templates).map((path) => replacePlaceholders(path, { name: 'my-pkg' }));
      assert.deepEqual(Object.keys(files).sort(), [...expected, 'LICENSE'].sort());
    });

    test('substitutes every placeholder', () => {
      for (const [path, text] of Object.entries(files)) {
        assert.ok(!hasPlaceholders(path) && !hasPlaceholders(text), path);
      }
    });

    test('copies a file without placeholders as is', () => {
      for (const [path, text] of Object.entries(templates)) {
        if (path === 'package.json' || hasPlaceholders(path) || hasPlaceholders(text)) continue;
        assert.equal(fileText(files, path), text, path);
      }
    });

    test('leaves the inject-end markers to inject-markdown', () => {
      for (const [path, text] of Object.entries(files)) assert.ok(!text.includes('@@inject-end'), path);
    });
  });

  test('substitutes name, fullName and description', async () => {
    const text = '{@ name @} | {@ fullName @} | {@ description @}';
    assert.equal(
      await substituteOne(text, 'my-pkg', { description: 'Does a.' }),
      'my-pkg | @streetsidesoftware/my-pkg | Does a. -- Private until verified',
    );
  });

  test('LICENSE is a copy of the root one', async () => {
    const files = await withTempRoot((templateDir) => newPackageFiles('a', { templateDir }));
    assert.equal(fileText(files, 'LICENSE'), await fs.readFile(ROOT_LICENSE_FILE, 'utf-8'));
  });

  test('appends the private suffix to a given description, once', async () => {
    for (const description of ['Does a.', 'Does a. -- Private until verified']) {
      assert.equal(await substituteOne('{@ description @}', 'a', { description }), 'Does a. -- Private until verified');
    }
  });

  test('a blank description falls back to the default', async () => {
    for (const description of ['', '   ']) {
      assert.equal(
        await substituteOne('{@ description @}', 'a', { description }),
        'TODO: describe the package. -- Private until verified',
      );
    }
  });

  test('package.json gets the lint fields, with engines.node from the root', async () => {
    const pkg = await substitutePackageJson({ name: '{@ fullName @}' }, 'my-pkg');
    assert.equal(pkg.name, '@streetsidesoftware/my-pkg');
    assert.deepEqual(pkg.repository, { type: 'git', url: REPOSITORY_GIT_URL, directory: 'packages/my-pkg' });
    assert.deepEqual(pkg.publishConfig, { access: 'public', provenance: true });
    assert.deepEqual(pkg.engines, { node: (await readPackageJson(ROOT_PACKAGE_JSON_FILE)).engines?.node });
  });

  test('a description with quotes and placeholders stays as given in package.json', async () => {
    const description = 'Says "hi" to {@ name @}.';
    const pkg = await substitutePackageJson({ description: '{@ description @}' }, 'a', { description });
    assert.equal(pkg.description, 'Says "hi" to {@ name @}. -- Private until verified');
  });

  test('throws on an invalid name', async () => {
    await assert.rejects(newPackageFiles('Bad'), /Invalid package name/);
  });

  test('substitutes placeholders in paths', async () => {
    await withTempRoot(async (templateDir) => {
      await fs.mkdir(Path.join(templateDir, 'src'));
      await fs.writeFile(Path.join(templateDir, 'src', '{@name@}.ts'), '{@ fullName @}');
      const files = await newPackageFiles('my-pkg', { templateDir });
      assert.equal(fileText(files, 'src/my-pkg.ts'), '@streetsidesoftware/my-pkg');
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
      assert.deepEqual(await readTemplateFiles(dir), await newPackageFiles('my-pkg'));
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

/** Substitute values into a one-file template and return the result. */
async function substituteOne(text: string, name: string, options: NewPackageOptions = {}): Promise<string> {
  return withTempRoot(async (templateDir) => {
    await fs.writeFile(Path.join(templateDir, 'file.txt'), text);
    return fileText(await newPackageFiles(name, { ...options, templateDir }), 'file.txt');
  });
}

/** Substitute values into a template that is only a `package.json`, and return the parsed result. */
async function substitutePackageJson(
  template: PackageJson,
  name: string,
  options: NewPackageOptions = {},
): Promise<PackageJson> {
  return withTempRoot(async (templateDir) => {
    await fs.writeFile(Path.join(templateDir, 'package.json'), JSON.stringify(template));
    return JSON.parse(fileText(await newPackageFiles(name, { ...options, templateDir }), 'package.json'));
  });
}

/** Read every file under `dir`, keyed by its path relative to `dir`, with `/` separators. */
async function readTemplateFiles(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await fs.readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = Path.join(entry.parentPath, entry.name);
    files[Path.relative(dir, file).replaceAll('\\', '/')] = await fs.readFile(file, 'utf-8');
  }
  return files;
}

async function withTempRoot<T>(fn: (rootDir: string) => Promise<T>): Promise<T> {
  const rootDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'new-package-'));
  try {
    return await fn(rootDir);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}
