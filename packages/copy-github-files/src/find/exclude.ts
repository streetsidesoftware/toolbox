import path from 'node:path';

// Repository paths always use `/`, so a backslash in a glob never counts as a separator, on Windows too.
const { matchesGlob } = path.posix;

/**
 * Create the test for whether a file is excluded: an exclude glob matches it, and no `!` glob does.
 * The test runs for every file, so everything that depends only on the globs is done here.
 */
export function createExcludeFilter(globs: Iterable<string>): (filePath: string) => boolean {
  // A string is an iterable of its characters, so a lone glob would be read one character at a time.
  if (typeof globs === 'string') throw new Error("The exclude option must be a list of globs, such as ['footer.md'].");
  const excludes: string[] = [];
  const keeps: string[] = [];
  for (const glob of globs) {
    if (glob.startsWith('!')) keeps.push(...toPathGlobs(glob.slice(1)));
    else excludes.push(...toPathGlobs(glob));
  }
  // Likely faster test first.
  return excludes.length < keeps.length
    ? (filePath) => matchesAny(filePath, excludes) && !matchesAny(filePath, keeps)
    : (filePath) => !matchesAny(filePath, keeps) && matchesAny(filePath, excludes);
}

function matchesAny(filePath: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(filePath, glob));
}

/**
 * Rewrite a glob that matches as a `.gitignore` line does into globs for `matchesGlob` on a file's whole path:
 * - A glob without a `/` matches at any depth.
 * - A match on a folder covers every file inside it. A glob that ends in `/` matches only folders.
 */
function toPathGlobs(glob: string): string[] {
  const folderOnly = glob.endsWith('/');
  const trimmed = folderOnly ? glob.slice(0, -1) : glob;
  const name = trimmed.replace(/^\//, '');
  if (!name) throw new Error('A glob to exclude must name a file or folder, such as footer.md.');
  const pathGlob = trimmed.includes('/') ? name : `**/${name}`;
  return folderOnly ? [`${pathGlob}/**`] : [pathGlob, `${pathGlob}/**`];
}
