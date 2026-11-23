import path from 'node:path';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

/** Return whether an exclude glob matches a file, and no `!` glob does. */
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
