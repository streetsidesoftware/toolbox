import fs from 'node:fs/promises';

import type { ApiFunction } from './api-exports.ts';
import { compare } from './packages.ts';

/** Holds the path of a package's reference config, relative to the package. */
export const CONFIG_FILE = '.api-referencerc.json';

/** Describes how a package's function reference is laid out. */
export interface ApiReferenceConfig {
  /** Holds the `###` sections, in the order the reference lists them. */
  groups: ApiGroupConfig[];
}

export interface ApiGroupConfig {
  heading: string;
  /** Holds the `@category` values whose functions go under this heading. */
  categories: string[];
  /** Holds the functions to list first, in this order. The rest follow alphabetically. */
  functions?: string[];
}

/** Describes one `###` section of the reference, its functions in order. */
export interface ApiGroup {
  heading: string;
  functions: ApiFunction[];
}

/**
 * Read and check a reference config.
 * @param name - The file as errors name it, such as `packages/x/.api-referencerc.json`.
 * @throws if the file is missing or isn't a valid config.
 */
export async function readApiReferenceConfig(file: string, name: string): Promise<ApiReferenceConfig> {
  const text = await fs.readFile(file, 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  });
  if (text === undefined) throw new Error(`${name} is missing: a package whose README injects the reference needs one`);
  return parseApiReferenceConfig(parseJson(text, name), name);
}

/** Check the shape of a parsed config. */
export function parseApiReferenceConfig(value: unknown, name: string): ApiReferenceConfig {
  if (!isObject(value) || !Array.isArray(value.groups)) throw new Error(`${name}: "groups" must be an array`);
  checkKeys(value, ['groups'], name);
  const groups = value.groups.map((group: unknown, i): ApiGroupConfig => {
    const where = `${name}: groups[${i}]`;
    if (!isObject(group)) throw new Error(`${where} must be an object`);
    checkKeys(group, ['heading', 'categories', 'functions'], where);
    const { heading, categories, functions } = group;
    if (typeof heading !== 'string' || !heading.trim()) throw new Error(`${where}.heading must be a non-empty string`);
    if (!isStrings(categories) || !categories.length) {
      throw new Error(`${where}.categories must be a non-empty array of strings`);
    }
    if (functions !== undefined && !isStrings(functions)) {
      throw new Error(`${where}.functions must be an array of strings`);
    }
    const repeated = duplicateIn(categories) ?? duplicateIn(functions ?? []);
    if (repeated) throw new Error(`${where} lists "${repeated}" more than once`);
    return functions === undefined ? { heading, categories } : { heading, categories, functions };
  });
  const heading = duplicateIn(groups.map((group) => group.heading));
  if (heading) throw new Error(`${name}: two groups have the heading "${heading}"`);
  return { groups };
}

/**
 * Sort functions into the config's groups, in its order.
 * Each group lists its `functions` first, then the rest alphabetically.
 * @throws if a category is in no group or in two, a group's category has no function, or a listed function isn't in
 * its group.
 */
export function groupFunctions(
  functions: readonly ApiFunction[],
  config: ApiReferenceConfig,
  name: string,
): ApiGroup[] {
  const groupOf = new Map<string, ApiGroupConfig>();
  for (const group of config.groups) {
    for (const category of group.categories) {
      if (groupOf.has(category)) throw new Error(`${name}: category "${category}" is in more than one group`);
      groupOf.set(category, group);
    }
  }
  for (const fn of functions) {
    if (!groupOf.has(fn.category)) {
      throw new Error(`${fn.name} has @category ${fn.category}, which no group in ${name} lists`);
    }
  }
  const used = new Set(functions.map((fn) => fn.category));
  const unused = [...groupOf.keys()].find((category) => !used.has(category));
  if (unused) throw new Error(`${name}: no function has @category ${unused}`);

  return config.groups.map((group) => {
    const members = functions.filter((fn) => group.categories.includes(fn.category));
    const lead = group.functions ?? [];
    const stray = lead.find((listed) => !members.some((fn) => fn.name === listed));
    if (stray) {
      const named = members.find((fn) => fn.aliases.includes(stray));
      if (named) throw new Error(`${name}: list ${named.name} under "${group.heading}", not its alias ${stray}`);
      throw new Error(`${name}: ${stray} is listed under "${group.heading}" but isn't in it`);
    }
    return {
      heading: group.heading,
      functions: members.toSorted((a, b) => rankIn(lead, a) - rankIn(lead, b) || compare(a.name, b.name)),
    };
  });
}

/**
 * Return a function's place in a group's leading list.
 * Every unlisted function shares the place after it.
 */
function rankIn(lead: readonly string[], fn: ApiFunction): number {
  const index = lead.indexOf(fn.name);
  return index < 0 ? lead.length : index;
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${name}: ${(error as Error).message}`, { cause: error });
  }
}

/** Throw on a key the config doesn't know, such as a misspelled `functions`. */
function checkKeys(object: Record<string, unknown>, keys: readonly string[], where: string): void {
  const unknown = Object.keys(object).find((key) => !keys.includes(key));
  if (unknown !== undefined) throw new Error(`${where} has an unknown key "${unknown}"`);
}

function duplicateIn(values: readonly string[]): string | undefined {
  return values.find((value, i) => values.indexOf(value) !== i);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
