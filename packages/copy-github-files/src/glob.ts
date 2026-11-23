import path from 'node:path';

import type { FetchOptions, GitHubSource } from './github.ts';
import { fetchGitHubPath } from './github.ts';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

/** Return whether a path is a pattern: it holds `*`, `?`, `[` or `{`. */
export function isPattern(repoPath: string): boolean {
  return /[*?[{]/.test(repoPath);
}

/**
 * Find the files a pattern matches.
 * - The segments before the first wildcard name the folder to start in.
 * - Each later segment is matched against the entries of the folders reached so far: folders for a middle segment,
 *   files for the last.
 */
export async function findFiles(source: GitHubSource, pattern: string, options: FetchOptions = {}): Promise<string[]> {
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

/** Return whether a glob matches a file, and no `!` glob does. */
export function isExcluded(filePath: string, globs: readonly string[]): boolean {
  const excludes = globs.filter((glob) => !glob.startsWith('!'));
  const keeps = globs.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));
  return excludes.some((glob) => matchesIgnore(filePath, glob)) && !keeps.some((glob) => matchesIgnore(filePath, glob));
}

/**
 * Return whether a glob matches a file the way a `.gitignore` line does, by rewriting it for `matchesGlob`:
 * - A glob without a `/` matches at any depth.
 * - A match on a folder covers every file inside it. A glob that ends in `/` matches only folders.
 */
function matchesIgnore(filePath: string, glob: string): boolean {
  const folderOnly = glob.endsWith('/');
  const trimmed = folderOnly ? glob.slice(0, -1) : glob;
  const anchored = trimmed.includes('/') ? trimmed.replace(/^\//, '') : `**/${trimmed}`;
  return (!folderOnly && matchesGlob(filePath, anchored)) || matchesGlob(filePath, `${anchored}/**`);
}
