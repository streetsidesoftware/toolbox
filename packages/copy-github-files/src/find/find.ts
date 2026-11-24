import assert from 'node:assert/strict';
import path from 'node:path';

import type { FetchOptions, GitHubPath, GitHubSource } from '../github/index.ts';
import { checkRepoPath, checkSource, fetchGitHubPath } from '../github/index.ts';
import { expandBraces } from './braces.ts';
import type { ExcludeFilter } from './exclude.ts';
import { createExcludeFilter } from './exclude.ts';

// Repository paths always use `/`, so a backslash in a file's name never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

export interface FindOptions extends FetchOptions {
  /**
   * Globs for the files to skip among those the patterns match:
   * - A file, in any folder: `footer.md`
   * - One file: `static/footer.md`
   * - All SVG files: `*.svg`
   * - A folder and everything in it: `drafts/`
   * - All SVG files below one folder: `static/**​/*.svg`
   *
   * To keep a file that another glob skips, add a glob that starts with `!`, such as `!logo.svg`. It always wins,
   * whatever its place in the list. It can't keep a file in a folder that is skipped.
   *
   * A path given in full is never skipped.
   */
  exclude?: Iterable<string> | undefined;
}

export interface FindResult {
  /** Each path given in full, and each file a pattern matched that isn't excluded. A file found twice is listed once. */
  files: string[];
  /** The patterns that matched no file, or whose every match was excluded. */
  unmatched: string[];
}

/**
 * Find the files to copy from a GitHub repository.
 *
 * A path names one file, or is a pattern for several:
 * - The Markdown files in a folder: `static/*.md`
 * - The Markdown files in the root folder: `*.md`
 * - Every file in a folder, but not its subfolders: `images/*`
 * - The PNG and SVG files in a folder: `images/*.{png,svg}`
 * - The README of each package: `packages/*​/README.md`
 *
 * A pattern doesn't support `**`. Any path with `*`, `?`, `[` or `{` in it is a pattern, with the syntax of Node's
 * `path.matchesGlob`.
 *
 * Each folder the patterns look in is one request. A path given in full makes none, and is kept as it is.
 *
 * A folder that can't be listed, such as one that doesn't exist, ends the search with its error.
 *
 * To copy the files, pass `files` to `copyGitHubFiles`.
 *
 * @param paths - from the root of the repository, such as `static/sponsor.md` or `static/img/*.png`.
 * @example
 * const source = { repo: 'streetsidesoftware/.github' };
 * const found = await findGitHubFiles(source, ['static/*.md'], { exclude: ['footer.md'] });
 * // found.files lists the Markdown files in static, except footer.md
 * // found.unmatched is []
 */
export async function findGitHubFiles(
  source: GitHubSource,
  paths: Iterable<string>,
  options?: FindOptions,
): Promise<FindResult> {
  checkSource(source);
  // A string is an iterable of its characters, so a lone path would be read one character at a time.
  assert(typeof paths !== 'string', "The paths must be a list of paths, such as ['static/sponsor.md'].");
  const isExcluded = createExcludeFilter(options?.exclude ?? []);
  // Every pattern is read before the first request, so a wrong one costs none.
  const searches = Array.from(new Set(paths), (repoPath) => ({
    repoPath,
    walks: isPattern(repoPath) ? expandBraces(repoPath).map(parseWalk) : undefined,
  }));
  const listFolder = createFolderLister(source, options);
  const seen = new Set<string>();
  const result: FindResult = { files: [], unmatched: [] };
  for (const { repoPath, walks } of searches) {
    const matches = walks ? await findMatches(listFolder, walks, isExcluded) : [repoPath];
    if (!matches.length) result.unmatched.push(repoPath);
    for (const file of matches) {
      if (!seen.has(file)) result.files.push(file);
      seen.add(file);
    }
  }
  return result;
}

type FolderLister = (folder: string) => Promise<GitHubPath>;

function createFolderLister(source: GitHubSource, options: FetchOptions | undefined): FolderLister {
  const listings = new Map<string, GitHubPath>();
  return async (folder) => {
    const listing = listings.get(folder) ?? (await fetchGitHubPath(source, folder, options));
    listings.set(folder, listing);
    return listing;
  };
}

function isPattern(repoPath: string): boolean {
  return /[*?[{]/.test(repoPath);
}

async function findMatches(listFolder: FolderLister, walks: Walk[], isExcluded: ExcludeFilter): Promise<string[]> {
  const found: string[] = [];
  for (const walk of walks) {
    for (const file of await walkFolders(listFolder, walk, isExcluded)) found.push(file);
  }
  return found;
}

interface Walk {
  /** The folder to start in, one name for each level. Empty for the root. */
  start: string[];
  /** Matched against the names in each folder from there: folders for a middle segment, files for the last. */
  segments: string[];
}

/** The last segment is always matched, since an expansion such as `static/a.md` can have no wildcard. */
function parseWalk(pattern: string): Walk {
  if (pattern.includes('**')) throw new Error("A pattern can't hold **.");
  const segments = pattern.split('/');
  const firstWildcard = segments.findIndex(isPattern);
  const matchFrom = firstWildcard < 0 ? segments.length - 1 : firstWildcard;
  const start = segments.slice(0, matchFrom);
  // The start of /*.md is an empty name, which would join to the root.
  if (start.length) checkRepoPath(start.join('/'));
  return { start, segments: segments.slice(matchFrom) };
}

/** List the folders a walk reaches, one segment at a time. An excluded folder is never listed. */
async function walkFolders(
  listFolder: FolderLister,
  { start, segments }: Walk,
  isExcluded: ExcludeFilter,
): Promise<string[]> {
  if (start.some((_, index) => isExcluded(start.slice(0, index + 1).join('/'), 'dir'))) return [];
  let found = [start.join('/')];
  for (const [index, segment] of segments.entries()) {
    const type = index === segments.length - 1 ? 'file' : 'dir';
    const matches: string[] = [];
    for (const folder of found) {
      const listing = await listFolder(folder);
      if (listing.type !== 'dir') continue;
      for (const entry of listing.entries) {
        if (entry.type !== type || !matchesGlob(entry.name, segment)) continue;
        if (!isExcluded(entry.path, type)) matches.push(entry.path);
      }
    }
    found = matches;
  }
  return found;
}
