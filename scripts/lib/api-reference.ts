import fs from 'node:fs/promises';
import Path from 'node:path';

import type { InlineContent } from '@streetsidesoftware/markdown-toolkit';
import * as md from '@streetsidesoftware/markdown-toolkit';

import type { ApiFunction } from './api-exports.ts';
import { readApiFunctions } from './api-exports.ts';
import type { ApiGroup } from './api-reference-config.ts';
import { CONFIG_FILE, groupFunctions, readApiReferenceConfig } from './api-reference-config.ts';
import { REPO_ROOT_DIR } from './consts.ts';
import { findPackages } from './packages.ts';

/** Holds the path a package's function reference is written to, relative to the package. */
export const API_REFERENCE_FILE = 'static/api-reference.md';

/** Holds the marker a package README injects its reference with. */
export const API_REFERENCE_MARKER = `<!--- @@inject: ${API_REFERENCE_FILE} --->`;

/** Holds the source file a package's reference is read from, relative to the package. */
export const ENTRY_FILE = 'src/index.ts';

/** Find the packages whose `README.md` injects their reference, by directory relative to the repo root. */
export async function findApiReferencePackages(rootDir: string = REPO_ROOT_DIR): Promise<string[]> {
  const found: string[] = [];
  for (const { dir } of await findPackages(rootDir)) {
    const readme = await fs.readFile(Path.join(rootDir, dir, 'README.md'), 'utf8').catch(() => '');
    if (readme.includes(API_REFERENCE_MARKER)) found.push(dir);
  }
  return found;
}

/** Render the `## Functions` section of a README: a `###` heading for each group, then one line per function. */
export function renderApiReference(groups: readonly ApiGroup[]): string {
  return md
    .document(
      md.heading(2, 'Functions'),
      groups.map((group) => [md.heading(3, group.heading), md.list(group.functions.map((fn) => functionLine(fn)))]),
    )
    .toString();
}

/**
 * Read a package's code and config, and render its reference.
 * @throws if the code's JSDoc or the config is invalid, or they don't match.
 */
export async function buildApiReference(packageDir: string, rootDir: string = REPO_ROOT_DIR): Promise<string> {
  const configName = Path.posix.join(packageDir, CONFIG_FILE);
  const config = await readApiReferenceConfig(Path.join(rootDir, packageDir, CONFIG_FILE), configName);
  const functions = await readApiFunctions(Path.join(rootDir, packageDir, ENTRY_FILE));
  return renderApiReference(groupFunctions(functions, config, configName));
}

/** Write a package's reference. Return whether the file changed. */
export async function updateApiReference(packageDir: string, rootDir: string = REPO_ROOT_DIR): Promise<boolean> {
  const file = Path.join(rootDir, packageDir, API_REFERENCE_FILE);
  const reference = await buildApiReference(packageDir, rootDir);
  if (reference === (await fs.readFile(file, 'utf8').catch(() => undefined))) return false;
  await fs.mkdir(Path.dirname(file), { recursive: true });
  await fs.writeFile(file, reference, 'utf8');
  return true;
}

/** Render one function's line: `` `name(params)` (also `alias`): summary ``. */
function functionLine(fn: ApiFunction): InlineContent[] {
  const aliases = fn.aliases.flatMap((alias, i) => [i ? ', ' : ' (also ', md.inlineCode(alias)]);
  return [
    md.inlineCode(`${fn.name}(${fn.params.join(', ')})`),
    ...aliases,
    fn.aliases.length ? '): ' : ': ',
    // The summary is Markdown that goes inside a line, so block syntax in it stays text.
    md.inlineTemplate(fn.summary, {}),
  ];
}
