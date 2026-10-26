import fs from 'node:fs/promises';
import Path from 'node:path';

import sortPackageJson from 'sort-package-json';

import { REPO_ROOT_DIR, REPOSITORY_GIT_URL } from './consts.ts';

const PUBLISH_CONFIG: PackageJsonPublishConfig = {
  access: 'public',
  provenance: true,
};

/** The root `package.json`, whose `engines.node` every package gets. */
export const ROOT_PACKAGE_JSON_FILE: string = Path.join(REPO_ROOT_DIR, 'package.json');

const SORT_PACKAGE_ORDER = ['name', 'version', 'private', 'description', 'repository', 'funding', 'publishConfig'];

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  keywords?: string[];
  repository?: PackageJsonRepository;
  publishConfig?: PackageJsonPublishConfig;
  funding?: string;
  [key: string]: unknown;
}

export interface PackageJsonRepository {
  type?: string;
  url?: string;
  directory?: string;
  [key: string]: unknown;
}

export interface PackageJsonPublishConfig {
  access?: 'public' | 'restricted';
  provenance?: boolean;
}

export function readPackageJson(filePath: string): Promise<PackageJson> {
  return fs.readFile(filePath, 'utf-8').then(JSON.parse);
}

export function stringifyPackageJson(packageJson: PackageJson): string {
  return JSON.stringify(packageJson, null, 2) + '\n';
}

export function formatPackageJson(packageJson: PackageJson): string {
  return stringifyPackageJson(sortPackageJson(packageJson, { sortOrder: SORT_PACKAGE_ORDER }));
}

export function setPackageRepository(packageJson: PackageJson, filePath: string) {
  const directory = Path.relative(REPO_ROOT_DIR, Path.dirname(filePath)).replaceAll('\\', '/');
  packageJson.repository = {
    type: 'git',
    url: REPOSITORY_GIT_URL,
    directory,
  };
}

export function fixUpPackageJson(packageJson: PackageJson, filePath: string, rootPackageJson: PackageJson) {
  const name = packageJson.name ?? '@internal/' + Path.basename(Path.dirname(filePath));
  packageJson.name = name;
  setPackageRepository(packageJson, filePath);

  const publishConfig = { ...PUBLISH_CONFIG };
  if (name.startsWith('@internal/')) {
    publishConfig.access = 'restricted';
  }
  packageJson.publishConfig = publishConfig;

  fixUpTemplatePackageJson(packageJson, rootPackageJson);
}

/** The fix-ups that don't depend on where a package lives, so the new-package template gets them too. */
export function fixUpTemplatePackageJson(packageJson: PackageJson, rootPackageJson: PackageJson) {
  if (packageJson.keywords) packageJson.keywords = [...new Set(packageJson.keywords)].sort();

  const node = rootPackageJson.engines?.node;
  if (!node) throw new Error(`${ROOT_PACKAGE_JSON_FILE} has no engines.node.`);
  packageJson.engines = { ...packageJson.engines, node };
}

export interface FixPackageJsonOptions {
  dryRun?: boolean;
  force?: boolean;
  /** Only the fix-ups in {@link fixUpTemplatePackageJson}, for the new-package template. */
  template?: boolean;
}

/**
 * Fixes up a package.json file, optionally writing the result back to disk.
 * @returns `true` if the file's contents needed fixing, `false` if it was already correct.
 */
export async function fixPackageJson(filePath: string, options: FixPackageJsonOptions): Promise<boolean> {
  const { dryRun, force, template } = options;
  const relPath = Path.relative(REPO_ROOT_DIR, filePath);
  console.error('Fixing package.json for: %s', relPath);
  const packageJson = await readPackageJson(filePath);
  const orig = await fs.readFile(filePath, 'utf-8');
  const rootPackageJson = await readPackageJson(ROOT_PACKAGE_JSON_FILE);
  if (template) fixUpTemplatePackageJson(packageJson, rootPackageJson);
  else fixUpPackageJson(packageJson, filePath, rootPackageJson);
  const result = formatPackageJson(packageJson);
  const needsFix = orig !== result;

  if (!needsFix && !force) {
    return false;
  }

  if (dryRun) {
    console.error('Dry run enabled, not writing changes for: %s', relPath);
    return needsFix;
  }

  await fs.writeFile(filePath, result, 'utf-8');
  return needsFix;
}
