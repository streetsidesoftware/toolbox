import path from 'node:path';

import type { FetchOptions, GitHubSource } from '../github/index.ts';
import { checkSource, fetchGitHubPath } from '../github/index.ts';
import { expandBraces } from './braces.ts';
import type { ExcludeFilter } from './exclude.ts';
import { createExcludeFilter } from './exclude.ts';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

export interface FindOptions extends FetchOptions {
  /**
   * Globs for the files to skip among those the patterns match. They work like the lines of a `.gitignore` file:
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
 * - Every file in a folder, but not its subfolders: `images/*`
 * - The PNG and SVG files in a folder: `images/*.{png,svg}`
 * - The README of each package: `packages/*​/README.md`
 *
 * A pattern starts with a folder name, and doesn't support `**`. Any path with `*`, `?`, `[` or `{` in it is a pattern,
 * with the syntax of Node's `path.matchesGlob`.
 *
 * Each folder a pattern looks in is one request. A path given in full makes none, and is kept as it is.
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
  if (typeof paths === 'string') throw new Error("The paths must be a list of paths, such as ['static/sponsor.md'].");
  const isExcluded = createExcludeFilter(options?.exclude ?? []);
  const seen = new Set<string>();
  const result: FindResult = { files: [], unmatched: [] };
  for (const repoPath of paths) {
    const matches = isPattern(repoPath) ? await findMatches(source, repoPath, isExcluded, options) : [repoPath];
    if (!matches.length) result.unmatched.push(repoPath);
    for (const file of matches) {
      if (!seen.has(file)) result.files.push(file);
      seen.add(file);
    }
  }
  return result;
}

function isPattern(repoPath: string): boolean {
  return /[*?[{]/.test(repoPath);
}

/** Find the files a pattern matches, from the folders that each of its expansions reaches. */
async function findMatches(
  source: GitHubSource,
  pattern: string,
  isExcluded: ExcludeFilter,
  options: FetchOptions | undefined,
): Promise<string[]> {
  const found: string[] = [];
  for (const walk of expandBraces(pattern).map(parseWalk)) {
    for (const file of await walkFolders(source, walk, isExcluded, options)) found.push(file);
  }
  return found;
}

interface Walk {
  /** The folder to start in, one name for each level. */
  start: string[];
  /** Matched against the names in each folder from there: folders for a middle segment, files for the last. */
  segments: string[];
}

/** The last segment is always matched, since an expansion such as `static/a.md` can have no wildcard. */
function parseWalk(pattern: string): Walk {
  const segments = pattern.split('/');
  const firstWildcard = segments.findIndex(isPattern);
  const matchFrom = firstWildcard < 0 ? segments.length - 1 : firstWildcard;
  if (matchFrom === 0) {
    throw new Error('A pattern must name a folder before its first wildcard, such as static/*.md.');
  }
  return { start: segments.slice(0, matchFrom), segments: segments.slice(matchFrom) };
}

/** List the folders a walk reaches, one segment at a time. An excluded folder is never listed. */
async function walkFolders(
  source: GitHubSource,
  { start, segments }: Walk,
  isExcluded: ExcludeFilter,
  options: FetchOptions | undefined,
): Promise<string[]> {
  if (start.some((_, index) => isExcluded(start.slice(0, index + 1).join('/'), 'dir'))) return [];
  let found = [start.join('/')];
  for (const [index, segment] of segments.entries()) {
    const type = index === segments.length - 1 ? 'file' : 'dir';
    const matches: string[] = [];
    for (const folder of found) {
      const listing = await fetchGitHubPath(source, folder, options);
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
