import fs from 'node:fs/promises';
import Path from 'node:path';

import { REPO_ROOT_DIR } from './consts.ts';
import { compare } from './packages.ts';
import { readJsonFile } from './release-please.ts';

/** The workflow each package names as its npm trusted publisher. */
export const WORKFLOW_FILE = 'publish.yml';

/**
 * Each package's publication state, relative to the repo root: `{ "trustedPublishing": false }` while it waits for
 * publication, `true` once it trusts `WORKFLOW_FILE`, and `false` instead of an entry for a package never to publish.
 */
export const PUBLISHED_FILE = 'static/published.json';

export interface TrustConfig {
  type?: string;
  file?: string;
  repository?: string;
  permissions?: string[];
}

export interface PublishedEntry {
  trustedPublishing?: boolean;
}

export type Published = Record<string, PublishedEntry | false>;

/**
 * Parse the output of `npm trust list --json`.
 * It prints one JSON object per trusted publisher, one after the other, and nothing if none.
 */
export function parseJsonValues(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return JSON.parse(`[${trimmed.replaceAll(/\}\s*\{/g, '},{')}]`);
}

export function hasPublisher(configs: TrustConfig[], repository: string): boolean {
  return configs.some((c) => c.type === 'github' && c.repository === repository && c.file === WORKFLOW_FILE);
}

/** Return a copy of `published` with `name`'s `trustedPublishing` set. */
export function recordTrusted(published: Published, name: string, trusted: boolean): Published {
  const entry = published[name];
  if (entry === false) throw new Error(`${PUBLISHED_FILE} marks ${name} as never to be published.`);
  return { ...published, [name]: { ...entry, trustedPublishing: trusted } };
}

/** Return a copy of `published` with `name` waiting for publication, unless it already has an entry. */
export function recordPending(published: Published, name: string): Published {
  return name in published ? published : { ...published, [name]: { trustedPublishing: false } };
}

/** Return a copy of `published` without the entries of packages not in `names`. A `false` entry is kept. */
export function prunePublished(published: Published, names: string[]): Published {
  return Object.fromEntries(
    Object.entries(published).filter(([name, entry]) => entry === false || names.includes(name)),
  );
}

/**
 * Format `published` with one package per line, sorted by name, so a change of state is a one-line diff.
 * Prettier doesn't format it.
 */
export function formatPublished(published: Published): string {
  const lines = Object.entries(published)
    .sort(([a], [b]) => compare(a, b))
    .map(([name, entry]) => `  ${JSON.stringify(name)}: ${formatEntry(entry)}`);
  return lines.length ? `{\n${lines.join(',\n')}\n}\n` : '{}\n';
}

function formatEntry(entry: PublishedEntry | false): string {
  if (entry === false) return 'false';
  const fields = Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return fields.length ? `{ ${fields.join(', ')} }` : '{}';
}

export async function readPublished(rootDir: string = REPO_ROOT_DIR): Promise<Published> {
  return (await readJsonFile<Published>(PUBLISHED_FILE, rootDir)) ?? {};
}

export async function writePublished(published: Published, rootDir: string = REPO_ROOT_DIR): Promise<void> {
  const file = Path.join(rootDir, PUBLISHED_FILE);
  await fs.mkdir(Path.dirname(file), { recursive: true });
  await fs.writeFile(file, formatPublished(published), 'utf8');
}
