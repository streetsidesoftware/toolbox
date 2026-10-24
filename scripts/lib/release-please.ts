import fs from 'node:fs/promises';
import Path from 'node:path';

import { REPO_ROOT_DIR } from './consts.ts';
import type { WorkspacePackage } from './packages.ts';
import { compare } from './packages.ts';
import { formatFile } from './prettier.ts';

/** The Release Please config, relative to the repo root. */
export const CONFIG_FILE = 'release-please-config.json';

/** The Release Please manifest of released versions, relative to the repo root. */
export const MANIFEST_FILE = '.release-please-manifest.json';

/** A package's entry in the config's `packages`. */
export interface PackageEntry {
  component: string;
  'release-as'?: string;
}

export interface ReleasePleaseConfig {
  packages: Record<string, PackageEntry>;
  [key: string]: unknown;
}

export type Manifest = Record<string, string>;

/** Every setting except `packages`. */
export const CONFIG_SETTINGS = {
  'include-v-in-tag': false,
  'tag-separator': '@',
  'prerelease-type': 'alpha',
  prerelease: true,
  plugins: [
    {
      type: 'node-workspace',
      'always-link-local': true,
      updatePeerDependencies: true,
    },
  ],
  'changelog-sections': [
    { type: 'feat', section: 'Features', hidden: false },
    { type: 'fix', section: 'Updates and Bug Fixes', hidden: false },
    { type: 'perf', section: 'Performance Improvements', hidden: false },
    { type: 'ci', section: 'Continuous Integration', hidden: true },
    { type: 'chore', section: 'Miscellaneous', hidden: true },
    { type: 'revert', section: 'Reverts', hidden: false },
    { type: 'docs', section: 'Documentation', hidden: true },
    { type: 'style', section: 'Styles', hidden: true },
    { type: 'refactor', section: 'Code Refactoring', hidden: true },
    { type: 'test', section: 'Tests', hidden: true },
  ],
};

/**
 * The config for the root package and every `packages/*` package, private ones included.
 * A `release-as` in `current` is kept until `manifest` shows that version was released.
 */
export function genConfig(
  root: WorkspacePackage,
  packages: WorkspacePackage[],
  current: ReleasePleaseConfig | undefined,
  manifest: Manifest,
): ReleasePleaseConfig {
  const entries: Record<string, PackageEntry> = {};
  for (const { dir, packageJson } of [root, ...packages]) {
    if (!packageJson.name) throw new Error(`${dir}/package.json has no name`);
    const entry: PackageEntry = { component: packageJson.name };
    const releaseAs = current?.packages[dir]?.['release-as'];
    if (releaseAs && manifest[dir] !== releaseAs) entry['release-as'] = releaseAs;
    entries[dir] = entry;
  }
  return { ...CONFIG_SETTINGS, packages: entries };
}

/** The manifest with an entry, at its `package.json` version, for each package that has none. */
export function genManifest(root: WorkspacePackage, packages: WorkspacePackage[], current: Manifest): Manifest {
  const manifest = { ...current };
  for (const { dir, packageJson } of [root, ...packages]) {
    if (manifest[dir] !== undefined) continue;
    if (!packageJson.version) throw new Error(`${dir}/package.json has no version`);
    manifest[dir] = packageJson.version;
  }
  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => compare(a, b)));
}

export async function readJsonFile<T>(relFile: string, rootDir: string = REPO_ROOT_DIR): Promise<T | undefined> {
  const text = await fs.readFile(Path.join(rootDir, relFile), 'utf8').catch(() => undefined);
  return text === undefined ? undefined : (JSON.parse(text) as T);
}

export async function formatJson(value: unknown, relFile: string, rootDir: string = REPO_ROOT_DIR): Promise<string> {
  return formatFile(JSON.stringify(value, null, 2), Path.join(rootDir, relFile));
}

/**
 * Sets or removes `release-as` for the named packages.
 * @param version - the version to release, or `undefined` to remove `release-as`.
 */
export function applyReleaseAs(
  config: ReleasePleaseConfig,
  names: string[],
  version: string | undefined,
): ReleasePleaseConfig {
  const entries = Object.values(config.packages);
  const unknown = names.filter((name) => !entries.some((e) => e.component === name));
  if (unknown.length) throw new Error(`Not in ${CONFIG_FILE}: ${unknown.join(', ')}`);

  const packages = Object.fromEntries(
    Object.entries(config.packages).map(([dir, entry]) => {
      if (!names.includes(entry.component)) return [dir, entry];
      const { 'release-as': _, ...rest } = entry;
      return [dir, version ? { ...rest, 'release-as': version } : rest];
    }),
  );
  return { ...config, packages };
}

/** Sets or removes `release-as` for the named packages, and writes the config. */
export async function writeReleaseAs(
  names: string[],
  version: string | undefined,
  rootDir: string = REPO_ROOT_DIR,
): Promise<void> {
  const config = await readJsonFile<ReleasePleaseConfig>(CONFIG_FILE, rootDir);
  if (!config) throw new Error(`${CONFIG_FILE} not found`);
  const updated = applyReleaseAs(config, names, version);
  await fs.writeFile(Path.join(rootDir, CONFIG_FILE), await formatJson(updated, CONFIG_FILE, rootDir), 'utf8');
  for (const name of names) console.log(`${name}: ${version ? `release-as ${version}` : 'removed release-as'}`);
}
