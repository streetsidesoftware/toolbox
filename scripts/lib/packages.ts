import fs from 'node:fs/promises';
import Path from 'node:path';

import { REPO_ROOT_DIR } from './consts.ts';
import type { PackageJson } from './package-json-util.ts';
import { readPackageJson } from './package-json-util.ts';

export interface WorkspacePackage {
  /** Holds the directory relative to the repo root, with `/` separators, such as `packages/unindent`. */
  dir: string;
  packageJson: PackageJson;
}

/** Find every `packages/*` package, sorted by directory. */
export async function findPackages(rootDir: string = REPO_ROOT_DIR): Promise<WorkspacePackage[]> {
  const found: WorkspacePackage[] = [];
  for await (const relFile of fs.glob('packages/*/package.json', { cwd: rootDir })) {
    const dir = Path.dirname(relFile).replaceAll('\\', '/');
    found.push({ dir, packageJson: await readPackageJson(Path.join(rootDir, relFile)) });
  }
  return found.sort((a, b) => compare(a.dir, b.dir));
}

/** Return the name of the `packages/*` package in the current folder, if there is one. */
export async function currentPackageName(rootDir: string = REPO_ROOT_DIR): Promise<string | undefined> {
  const relative = Path.relative(rootDir, process.cwd());
  if (!/^packages[/\\][^/\\]+$/.test(relative)) return undefined;
  const pkg = await readPackageJson(Path.join(process.cwd(), 'package.json')).catch(() => undefined);
  return pkg?.name;
}

export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
