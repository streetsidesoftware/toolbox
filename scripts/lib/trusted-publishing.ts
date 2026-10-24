/** The workflow each package names as its npm trusted publisher. */
export const WORKFLOW_FILE = 'publish.yml';

/** Packages known to trust `WORKFLOW_FILE`, relative to the repo root, so a run can skip them without asking npm. */
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

export type Published = Record<string, PublishedEntry>;

/** `npm trust list --json` prints one JSON object per trusted publisher, one after the other, and nothing if none. */
export function parseJsonValues(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return JSON.parse(`[${trimmed.replaceAll(/\}\s*\{/g, '},{')}]`);
}

export function hasPublisher(configs: TrustConfig[], repository: string): boolean {
  return configs.some((c) => c.type === 'github' && c.repository === repository && c.file === WORKFLOW_FILE);
}

/** A copy of `published` with `name` recorded as trusted or not, sorted by name. */
export function recordTrusted(published: Published, name: string, trusted: boolean): Published {
  const entry: PublishedEntry = { ...published[name] };
  if (trusted) {
    entry.trustedPublishing = true;
  } else {
    delete entry.trustedPublishing;
  }
  const next: Published = { ...published, [name]: entry };
  if (!Object.keys(entry).length) delete next[name];
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
