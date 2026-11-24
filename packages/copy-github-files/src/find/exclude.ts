import path from 'node:path';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

/** Returns whether an exclude glob matches the file or folder itself, and no `!` glob does. */
export type ExcludeFilter = (entryPath: string, type: 'file' | 'dir') => boolean;

interface ExcludeGlob {
  /** Matched against the whole path. */
  pathGlob: string;
  folderOnly: boolean;
}

/**
 * Create the test for whether a file or folder is excluded, from globs that match as `.gitignore` lines do.
 * The test runs for every file and folder, so everything that depends only on the globs is done here.
 */
export function createExcludeFilter(globs: Iterable<string>): ExcludeFilter {
  // A string is an iterable of its characters, so a lone glob would be read one character at a time.
  if (typeof globs === 'string') throw new Error("The exclude option must be a list of globs, such as ['footer.md'].");
  const excludes: ExcludeGlob[] = [];
  const keeps: ExcludeGlob[] = [];
  for (const glob of globs) {
    if (glob.startsWith('!')) keeps.push(parseGlob(glob.slice(1)));
    else excludes.push(parseGlob(glob));
  }
  // Likely faster test first.
  return excludes.length < keeps.length
    ? (entryPath, type) => matchesAny(entryPath, type, excludes) && !matchesAny(entryPath, type, keeps)
    : (entryPath, type) => !matchesAny(entryPath, type, keeps) && matchesAny(entryPath, type, excludes);
}

function matchesAny(entryPath: string, type: 'file' | 'dir', globs: readonly ExcludeGlob[]): boolean {
  return globs.some(({ pathGlob, folderOnly }) => (type === 'dir' || !folderOnly) && matchesGlob(entryPath, pathGlob));
}

/** A glob without a `/` at its start or in its middle matches at any depth. */
function parseGlob(glob: string): ExcludeGlob {
  const folderOnly = glob.endsWith('/');
  const trimmed = folderOnly ? glob.slice(0, -1) : glob;
  const name = trimmed.replace(/^\//, '');
  if (!name) throw new Error('A glob to exclude must name a file or folder, such as footer.md.');
  return { pathGlob: trimmed.includes('/') ? name : `**/${name}`, folderOnly };
}
