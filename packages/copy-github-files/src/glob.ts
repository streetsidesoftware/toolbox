import path from 'node:path';

import type { FetchOptions, GitHubSource } from './github.ts';
import { listGitHubFolder } from './github.ts';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

/** Return whether a path is a pattern: any of its segments holds `*`, `?`, `[` or `{`. */
export function isPattern(repoPath: string): boolean {
  return /[*?[{]/.test(repoPath);
}

/**
 * Find the files a pattern matches, one segment at a time:
 * - The segments before the first wildcard name a folder. A failure to list it rejects.
 * - Each later segment is matched against the entries of the folders reached so far: folders for a middle segment,
 *   files for the last. A segment without a wildcard there is matched as a name, so a folder that lacks it adds
 *   nothing instead of failing.
 *
 * Symlinks and submodules never match.
 */
export async function findFiles(source: GitHubSource, pattern: string, options: FetchOptions): Promise<string[]> {
  const segments = pattern.split('/');
  const firstWildcard = segments.findIndex(isPattern);
  const rest = segments.slice(firstWildcard);
  let found = [segments.slice(0, firstWildcard).join('/')];
  for (const [index, segment] of rest.entries()) {
    const type = index === rest.length - 1 ? 'file' : 'dir';
    const matches: string[] = [];
    for (const folder of found) {
      for (const entry of await listGitHubFolder(source, folder, options)) {
        if (entry.type === type && matchesGlob(entry.name, segment)) matches.push(entry.path);
      }
    }
    found = matches;
  }
  return found;
}

/** The globs given to exclude files: the ones that exclude, and the `!` ones that keep what they match. */
export interface Excludes {
  exclude: Glob[];
  keep: Glob[];
}

interface Glob {
  glob: string;
  /** Matched against the path from the root, because the glob held a `/` at its start or in its middle. */
  anchored: boolean;
  /** Matched only against folders, because the glob ended in `/`. */
  folderOnly: boolean;
}

/** Read the globs to exclude, the way `.gitignore` reads its lines, except that a `!` glob always wins. */
export function parseExcludes(globs: Iterable<string>): Excludes {
  // A string is an iterable of its characters, so a lone glob would be read one character at a time.
  if (typeof globs === 'string') throw new Error("The exclude option must be a list of globs, such as ['banner.png'].");
  const excludes: Excludes = { exclude: [], keep: [] };
  for (const given of globs) {
    const keep = given.startsWith('!');
    let glob = keep ? given.slice(1) : given;
    const folderOnly = glob.endsWith('/');
    if (folderOnly) glob = glob.slice(0, -1);
    const anchored = glob.includes('/');
    if (glob.startsWith('/')) glob = glob.slice(1);
    if (!glob) throw new Error('A glob to exclude must name a file or folder, such as banner.png.');
    (keep ? excludes.keep : excludes.exclude).push({ glob, anchored, folderOnly });
  }
  return excludes;
}

/** Return whether a file is excluded: an exclude glob matches it, and no `!` glob does. */
export function isExcluded(filePath: string, excludes: Excludes): boolean {
  return (
    excludes.exclude.some((glob) => matchesPath(filePath, glob)) &&
    !excludes.keep.some((glob) => matchesPath(filePath, glob))
  );
}

/**
 * Return whether a glob matches a file or a folder above it, as in `.gitignore`:
 * - An anchored glob is matched against the path from the root to the file, and to each folder above it.
 * - Any other glob is matched against the name of the file, and of each folder above it.
 */
function matchesPath(filePath: string, { glob, anchored, folderOnly }: Glob): boolean {
  const segments = filePath.split('/');
  const count = folderOnly ? segments.length - 1 : segments.length;
  for (let index = 0; index < count; index += 1) {
    const candidate = anchored ? segments.slice(0, index + 1).join('/') : segments[index];
    if (candidate !== undefined && matchesGlob(candidate, glob)) return true;
  }
  return false;
}
