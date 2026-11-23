import path from 'node:path';

import type { FetchOptions, GitHubSource } from '../github/index.ts';
import { checkSource, fetchGitHubPath } from '../github/index.ts';
import { isExcluded } from './exclude.ts';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

export interface FindOptions extends FetchOptions {
  /**
   * Globs for files that a pattern matches but that aren't to be copied, matched the way `.gitignore` matches:
   * - A glob without a `/` matches the name of the file, or of any folder above it, such as `banner.png`.
   * - A glob with a `/` at its start or in its middle matches the path from the root of the repository.
   * - A glob that ends in `/` matches only folders.
   * - `**` matches any number of folders.
   * - A glob that starts with `!` keeps the files it matches, whatever other globs match them.
   *
   * A path given in full is never excluded.
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
 * Find the files to copy from a GitHub repository, for paths that can hold patterns.
 *
 * A path with `*`, `?`, `[` or `{` in it is a pattern, such as `static/img/*.png`:
 * - Each segment after the first is matched against the names in one folder, with the syntax of Node's
 *   `path.matchesGlob`. The last segment matches files, and the segments before it match folders.
 * - The first segment names a folder, so it can't hold a wildcard.
 * - A pattern doesn't reach into subfolders, and `**` isn't supported in it.
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
  const exclude = [...(options?.exclude ?? [])];
  const seen = new Set<string>();
  const result: FindResult = { files: [], unmatched: [] };
  for (const repoPath of paths) {
    const matches = isPattern(repoPath)
      ? (await findMatches(source, repoPath, options)).filter((file) => !isExcluded(file, exclude))
      : [repoPath];
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

/**
 * List the folders a pattern reaches, one segment at a time: folders for a middle segment, files for the last.
 * The segments before the first wildcard name the folder to start in.
 */
async function findMatches(
  source: GitHubSource,
  pattern: string,
  options: FetchOptions | undefined,
): Promise<string[]> {
  const segments = pattern.split('/');
  const firstWildcard = segments.findIndex(isPattern);
  if (firstWildcard === 0) {
    throw new Error('A pattern must name a folder before its first wildcard, such as static/*.md.');
  }
  let found = [segments.slice(0, firstWildcard).join('/')];
  for (let index = firstWildcard; index < segments.length; index += 1) {
    const segment = segments[index] ?? '';
    const type = index === segments.length - 1 ? 'file' : 'dir';
    const matches: string[] = [];
    for (const folder of found) {
      const listing = await fetchGitHubPath(source, folder, options);
      if (listing.type !== 'dir') continue;
      for (const entry of listing.entries) {
        if (entry.type === type && matchesGlob(entry.name, segment)) matches.push(entry.path);
      }
    }
    found = matches;
  }
  return found;
}
