import assert from 'node:assert/strict';
import path from 'node:path';

// Repository paths always use `/`, so a backslash in a file's name never counts as a separator, on Windows too.
const { basename, matchesGlob } = path.posix;

/** Returns whether an exclude glob matches the file or folder itself, and no `!` glob does. */
export type ExcludeFilter = (entryPath: string, type: 'file' | 'dir') => boolean;

interface ExcludeGlob {
  glob: string;
  /** Match the name alone, at any depth, instead of the whole path. */
  nameOnly: boolean;
  folderOnly: boolean;
}

/**
 * Create the test for whether a file or folder is excluded.
 * The test runs for every file and folder, so everything that depends only on the globs is done here.
 */
export function createExcludeFilter(globs: Iterable<string>): ExcludeFilter {
  // A string is an iterable of its characters, so a lone glob would be read one character at a time.
  assert(typeof globs !== 'string', "The exclude option must be a list of globs, such as ['footer.md'].");
  const excludes: ExcludeGlob[] = [];
  const keeps: ExcludeGlob[] = [];
  for (const glob of globs) {
    if (glob.startsWith('!')) keeps.push(parseGlob(glob.slice(1)));
    else excludes.push(parseGlob(glob));
  }
  return excludes.length < keeps.length
    ? (entryPath, type) => matchesAny(entryPath, type, excludes) && !matchesAny(entryPath, type, keeps)
    : (entryPath, type) => !matchesAny(entryPath, type, keeps) && matchesAny(entryPath, type, excludes);
}

function matchesAny(entryPath: string, type: 'file' | 'dir', globs: readonly ExcludeGlob[]): boolean {
  const entryName = basename(entryPath);
  return globs.some(
    ({ glob, nameOnly, folderOnly }) =>
      (type === 'dir' || !folderOnly) && matchesGlob(nameOnly ? entryName : entryPath, glob),
  );
}

/** Read a glob. One without a `/` at its start or in its middle matches a name at any depth. */
function parseGlob(glob: string): ExcludeGlob {
  const folderOnly = glob.endsWith('/');
  const trimmed = folderOnly ? glob.slice(0, -1) : glob;
  const name = trimmed.replace(/^\//, '');
  if (!name) throw new Error('A glob to exclude must name a file or folder, such as footer.md.');
  return { glob: name, nameOnly: !trimmed.includes('/'), folderOnly };
}
