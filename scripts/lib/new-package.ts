import fs from 'node:fs/promises';
import Path from 'node:path';

import { REPO_ROOT_DIR } from './consts.ts';
import type { PackageJson } from './package-json-util.ts';
import { fixUpPackageJson, formatPackageJson } from './package-json-util.ts';

export const SCOPE = '@streetsidesoftware';
export const PRIVATE_SUFFIX = ' -- Private until verified';
export const DEFAULT_DESCRIPTION = 'TODO: describe the package.';

/** Lowercase words of letters and digits joined by single hyphens, such as `test-each`. */
const NAME_REGEXP = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface NewPackageOptions {
  description?: string | undefined;
  /** The year in `LICENSE`; default: the current year. */
  year?: number | undefined;
}

export interface CreatePackageOptions extends NewPackageOptions {
  rootDir?: string | undefined;
}

/** Throws if `name` can't be a `packages/<name>` folder and `@streetsidesoftware/<name>` package. */
export function validatePackageName(name: string): void {
  if (!NAME_REGEXP.test(name)) {
    throw new Error(
      `Invalid package name "${name}": use lowercase letters, digits and single hyphens, starting with a letter, ` +
        `such as "test-each", without the ${SCOPE}/ scope.`,
    );
  }
}

/** The files of a new private package, keyed by path relative to its folder. */
export function newPackageFiles(name: string, options: NewPackageOptions = {}): Record<string, string> {
  validatePackageName(name);
  const fullName = `${SCOPE}/${name}`;
  const description = (options.description ?? DEFAULT_DESCRIPTION) + PRIVATE_SUFFIX;
  const year = options.year ?? new Date().getFullYear();

  return {
    'package.json': packageJsonText(name, fullName, description),
    'tsconfig.json': TSCONFIG,
    'tsdown.config.ts': TSDOWN_CONFIG,
    LICENSE: license(year),
    'README.md': readme(fullName),
    'src/index.ts': `export const packageName = '${fullName}';\n`,
    [`src/${name}.test.ts`]: testFile(fullName),
  };
}

/**
 * Writes a new private package to `packages/<name>/`.
 * @returns the package folder.
 */
export async function createPackage(name: string, options: CreatePackageOptions = {}): Promise<string> {
  const files = newPackageFiles(name, options);
  const dir = Path.join(options.rootDir ?? REPO_ROOT_DIR, 'packages', name);
  if (await exists(dir)) throw new Error(`${dir} already exists.`);

  for (const [relPath, content] of Object.entries(files)) {
    const file = Path.join(dir, relPath);
    await fs.mkdir(Path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf-8');
  }
  return dir;
}

function packageJsonText(name: string, fullName: string, description: string): string {
  const packageJson: PackageJson = {
    name: fullName,
    version: '0.0.1-alpha.0',
    private: true,
    description,
    license: 'MIT',
    type: 'module',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    },
    main: './dist/index.js',
    types: './dist/index.d.ts',
    files: ['dist', '!dist/**/*.map'],
    scripts: {
      build: 'tsdown',
      clean: 'shx rm -rf dist coverage',
      test: 'node --test "src/**/*.test.ts"',
      typecheck: 'tsc --noEmit',
    },
    engines: {
      node: '>=22.18.0',
    },
  };
  // Add repository and publishConfig the way `fix-package-json` does, so the new package already passes lint.
  fixUpPackageJson(packageJson, Path.join(REPO_ROOT_DIR, 'packages', name, 'package.json'));
  return formatPackageJson(packageJson);
}

const TSCONFIG = `{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
`;

const TSDOWN_CONFIG = `import { mergeConfig } from 'tsdown';

import base from '../../.config/tsdown.config.ts';

export default mergeConfig(base, {
  entry: ['src/index.ts'],
});
`;

function license(year: number): string {
  return `MIT License

Copyright (c) ${year} Street Side Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

// The inject markers stay empty: the Update READMEs workflow fills them in after the merge.
function readme(fullName: string): string {
  return `# ${fullName}

TODO: describe the package.

## Install

\`\`\`sh
npm install ${fullName}
\`\`\`

Requires Node.js 22.18 or later. ESM only.

## License

MIT

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<!--- @@inject-end: ../../static/footer.md --->
`;
}

function testFile(fullName: string): string {
  return `import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { packageName } from './index.ts';

describe('packageName', () => {
  test('is the package name', () => {
    assert.equal(packageName, '${fullName}');
  });
});
`;
}

async function exists(path: string): Promise<boolean> {
  return fs.stat(path).then(
    () => true,
    () => false,
  );
}
