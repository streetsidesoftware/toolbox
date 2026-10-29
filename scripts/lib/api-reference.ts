import fs from 'node:fs/promises';
import Path from 'node:path';

import type { InlineContent } from '@streetsidesoftware/markdown-toolkit';
import * as md from '@streetsidesoftware/markdown-toolkit';

import type { ApiFunction } from './api-exports.ts';
import { readApiFunctions } from './api-exports.ts';
import { REPO_ROOT_DIR } from './consts.ts';
import { compare, findPackages } from './packages.ts';

/** Where a package's function reference is written, relative to the package. */
export const API_REFERENCE_FILE = 'static/api-reference.md';

/** The marker a package README injects its reference with. */
export const API_REFERENCE_MARKER = `<!--- @@inject: ${API_REFERENCE_FILE} --->`;

/** The source a package's reference is read from, relative to the package. */
export const ENTRY_FILE = 'src/index.ts';

/** The packages whose `README.md` injects their reference, by directory relative to the repo root. */
export async function findApiReferencePackages(rootDir: string = REPO_ROOT_DIR): Promise<string[]> {
  const found: string[] = [];
  for (const { dir } of await findPackages(rootDir)) {
    const readme = await fs.readFile(Path.join(rootDir, dir, 'README.md'), 'utf8').catch(() => '');
    if (readme.includes(API_REFERENCE_MARKER)) found.push(dir);
  }
  return found;
}

/**
 * The `## Functions` section of a README: a `###` heading for each category, then one line per function.
 * Categories and functions are in alphabetical order.
 */
export function renderApiReference(functions: readonly ApiFunction[]): string {
  const byCategory = Map.groupBy(functions, (fn) => fn.category);
  const categories = [...byCategory.keys()].sort(compare);
  return md
    .document(
      md.heading(2, 'Functions'),
      categories.map((category) => [
        md.heading(3, category),
        md.list(
          (byCategory.get(category) ?? []).toSorted((a, b) => compare(a.name, b.name)).map((fn) => functionLine(fn)),
        ),
      ]),
    )
    .toString();
}

/** Writes a package's reference. Returns whether the file changed. */
export async function updateApiReference(packageDir: string, rootDir: string = REPO_ROOT_DIR): Promise<boolean> {
  const functions = await readApiFunctions(Path.join(rootDir, packageDir, ENTRY_FILE));
  const file = Path.join(rootDir, packageDir, API_REFERENCE_FILE);
  const reference = renderApiReference(functions);
  if (reference === (await fs.readFile(file, 'utf8').catch(() => undefined))) return false;
  await fs.mkdir(Path.dirname(file), { recursive: true });
  await fs.writeFile(file, reference, 'utf8');
  return true;
}

/** `` `name(params)` (also `alias`): summary ``. */
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
