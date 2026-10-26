import fs from 'node:fs/promises';
import Path from 'node:path';

import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';

import { REPO_ROOT_DIR } from './consts.ts';
import type { PackageJson } from './package-json-util.ts';
import { fixUpPackageJson, formatPackageJson } from './package-json-util.ts';

export const SCOPE = '@streetsidesoftware';
export const PRIVATE_SUFFIX = ' -- Private until verified';
export const DEFAULT_DESCRIPTION = 'TODO: describe the package.';
export const TEMPLATE_DIR: string = Path.join(REPO_ROOT_DIR, 'static', 'templates');

/** Lowercase words of letters and digits joined by single hyphens, such as `test-each`. */
const NAME_REGEXP = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface NewPackageOptions {
  description?: string | undefined;
  /** The year in `LICENSE`; default: the current year. */
  year?: number | undefined;
  /** The folder of template files; default: {@link TEMPLATE_DIR}. */
  templateDir?: string | undefined;
}

/** The values the templates' placeholders take. */
type TemplateValues = Record<'name' | 'fullName' | 'description', string> & { year: number };

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

/**
 * The files of a new private package, keyed by path relative to its folder: the templates in `static/templates/`,
 * with their placeholders filled in.
 */
export async function newPackageFiles(name: string, options: NewPackageOptions = {}): Promise<Record<string, string>> {
  validatePackageName(name);
  const values: TemplateValues = {
    name,
    fullName: `${SCOPE}/${name}`,
    description: privateDescription(options.description),
    year: options.year ?? new Date().getFullYear(),
  };
  const templateDir = options.templateDir ?? TEMPLATE_DIR;
  const templates = await readTemplates(templateDir);
  assertKnownPlaceholders(templates, values, templateDir);

  const files: Record<string, string> = {};
  for (const [relPath, text] of Object.entries(templates)) {
    const path = replacePlaceholders(relPath, values);
    files[path] = path === 'package.json' ? packageJsonText(name, text, values) : replacePlaceholders(text, values);
  }
  return files;
}

/**
 * Writes a new private package to `packages/<name>/`.
 * @returns the package folder.
 */
export async function createPackage(name: string, options: CreatePackageOptions = {}): Promise<string> {
  const files = await newPackageFiles(name, options);
  const dir = Path.join(options.rootDir ?? REPO_ROOT_DIR, 'packages', name);
  await fs.mkdir(Path.dirname(dir), { recursive: true });
  // Not recursive, so it fails if the folder already exists.
  await fs.mkdir(dir).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`${dir} already exists.`);
    throw error;
  });

  try {
    for (const [relPath, content] of Object.entries(files)) {
      const file = Path.join(dir, relPath);
      await fs.mkdir(Path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, 'utf-8');
    }
  } catch (error) {
    // The folder is new, so remove it rather than leave a half-written package behind.
    await fs.rm(dir, { recursive: true, force: true });
    throw error;
  }
  return dir;
}

/** Trims `description`, defaults it if blank, and ends it with {@link PRIVATE_SUFFIX} once. */
export function privateDescription(description: string | undefined): string {
  const suffix = PRIVATE_SUFFIX.trim();
  let text = description?.trim() ?? '';
  if (text.endsWith(suffix)) text = text.slice(0, -suffix.length).trim();
  return (text || DEFAULT_DESCRIPTION) + PRIVATE_SUFFIX;
}

// Placeholders are filled in the parsed string values, so a value with a `"` can't break the JSON.
function packageJsonText(name: string, template: string, values: TemplateValues): string {
  const packageJson: PackageJson = JSON.parse(template, (_key, value: unknown) =>
    typeof value === 'string' ? replacePlaceholders(value, values) : value,
  );
  // Add repository and publishConfig the way `fix-package-json` does, so the new package already passes lint.
  fixUpPackageJson(packageJson, Path.join(REPO_ROOT_DIR, 'packages', name, 'package.json'));
  return formatPackageJson(packageJson);
}

/** Every file under `dir`, keyed by its path relative to `dir`, with `/` separators. */
async function readTemplates(dir: string): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
  for (const entry of entries.filter((entry) => entry.isFile())) {
    const file = Path.join(entry.parentPath, entry.name);
    templates[Path.relative(dir, file).replaceAll('\\', '/')] = await fs.readFile(file, 'utf-8');
  }
  return templates;
}

/** Throws if a template's path or text uses a placeholder that `values` has no value for. */
function assertKnownPlaceholders(templates: Record<string, string>, values: TemplateValues, dir: string): void {
  const unknown: string[] = [];
  for (const [relPath, text] of Object.entries(templates)) {
    for (const { name } of [...listPlaceholders(relPath), ...listPlaceholders(text)]) {
      if (!Object.hasOwn(values, name)) unknown.push(`${relPath}: {@ ${name} @}`);
    }
  }
  if (unknown.length) {
    throw new Error(`Unknown placeholders in ${dir}:\n  ${[...new Set(unknown)].join('\n  ')}`);
  }
}
