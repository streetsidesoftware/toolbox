import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FetchOptions, GitHubSource } from './github.ts';
import { checkSource, fetchGitHubFile } from './github.ts';
import type { Excludes } from './glob.ts';
import { findFiles, isExcluded, isPattern, parseExcludes } from './glob.ts';

/** What happened to one file: the local file it was written to, or why it wasn't copied. */
export type CopyResult = { path: string; file: string } | { path: string; error: Error };

export interface CopyOptions extends FetchOptions {
  /**
   * How many files to download at once.
   * @default 8
   */
  concurrency?: number | undefined;
  /**
   * Globs for files that a pattern finds but that aren't copied, matched the way `.gitignore` matches its lines:
   * - A glob without a `/` matches the name of the file, or of any folder above it, such as `banner.png`.
   * - A glob with a `/` at its start or in its middle matches the path from the root of the repository.
   * - A glob that ends in `/` matches only folders, so `drafts/` skips every file inside a folder named `drafts`.
   * - `**` matches any number of folders.
   * - A glob that starts with `!` keeps the files it matches, whatever other globs match them.
   *
   * A path given in full is always copied.
   */
  exclude?: Iterable<string> | undefined;
}

const defaultConcurrency = 8;

/**
 * Copy files from a GitHub repository into a folder. Each file keeps its path from the root of the repository.
 *
 * A path with `*`, `?`, `[` or `{` in it is a pattern, such as `static/img/*.png`:
 * - Each segment is matched against the names in one folder, with the syntax of Node's `path.matchesGlob`. The last
 *   segment matches files, and the segments before it match folders.
 * - A pattern doesn't reach into subfolders, and `**` isn't supported in it.
 * - A pattern that ends up with no file to copy gives a failed result.
 * - The `exclude` option skips some of the files that patterns find.
 *
 * Several files download at once. Each file's result comes as soon as that file is written or has failed, so results
 * can come in any order.
 *
 * A failed file doesn't stop the others. Its result holds the error.
 *
 * To stop early:
 * - Break out of the loop.
 * - Abort the signal. The loop then throws the signal's reason, such as the `TimeoutError` of `AbortSignal.timeout()`.
 *
 * Either way, downloads still running are stopped, and only the files already given as results are written.
 *
 * @param paths - from the root of the repository, such as `static/sponsor.md` or `static/img/*.png`.
 * @example
 * const source = { repo: 'streetsidesoftware/.github' };
 * for await (const result of copyGitHubFiles(source, ['static/sponsor.md'], '.')) {
 *   console.log('error' in result ? `Failed to copy ${result.path}` : `Copied ${result.file}`);
 * }
 * // Copied static/sponsor.md
 */
export async function* copyGitHubFiles(
  source: GitHubSource,
  paths: Iterable<string>,
  folder: string,
  options: CopyOptions = {},
): AsyncIterable<CopyResult> {
  checkSource(source);
  // A string is an iterable of its characters, so a lone path would be read one character at a time.
  if (typeof paths === 'string') throw new Error("The paths must be a list of paths, such as ['static/sponsor.md'].");
  const concurrency = options.concurrency ?? defaultConcurrency;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('The concurrency must be a whole number of at least 1.');
  }
  const excludes = parseExcludes(options.exclude ?? []);
  options.signal?.throwIfAborted();

  // Stops every download still running when the loop ends early, through a break, a return or a throw.
  const internal = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, internal.signal]) : internal.signal;
  const pending = pullOnce(source, paths, excludes, signal);
  const running = new Set<Promise<Finished>>();
  try {
    for (;;) {
      while (running.size < concurrency) {
        const next = await pending.next();
        if (next.done) break;
        running.add(start(typeof next.value === 'string' ? download(source, next.value, signal) : next.value));
      }
      if (!running.size) return;
      const finished = await Promise.race(running);
      running.delete(finished.task);
      options.signal?.throwIfAborted();
      yield await write(finished.downloaded, folder);
      options.signal?.throwIfAborted();
    }
  } finally {
    internal.abort();
    await pending.return();
  }
}

type Failure = { path: string; error: Error };
type Download = { path: string; content: Uint8Array } | Failure;
type Finished = { task: Promise<Finished>; downloaded: Download };

/** Add a download to the race. The result names its own task, so the race can remove it from the running set. */
function start(downloading: Download | Promise<Download>): Promise<Finished> {
  const task: Promise<Finished> = Promise.resolve(downloading).then((downloaded) => ({ task, downloaded }));
  return task;
}

/**
 * Read the paths only as they're needed, and give each file to download once.
 * A pattern's files are found when its turn comes. A pattern that can't be listed, or that ends up with no file to
 * copy, comes as a failure in their place.
 */
async function* pullOnce(
  source: GitHubSource,
  paths: Iterable<string>,
  excludes: Excludes,
  signal: AbortSignal,
): AsyncGenerator<string | Failure, void> {
  const seen = new Set<string>();
  const seenPatterns = new Set<string>();
  for (const repoPath of paths) {
    if (!isPattern(repoPath)) {
      if (!seen.has(repoPath)) yield repoPath;
      seen.add(repoPath);
      continue;
    }
    if (seenPatterns.has(repoPath)) continue;
    seenPatterns.add(repoPath);
    let files: string[];
    try {
      files = (await findFiles(source, repoPath, { signal })).filter((file) => !isExcluded(file, excludes));
    } catch (error) {
      yield { path: repoPath, error: toError(error) };
      continue;
    }
    if (!files.length) {
      yield { path: repoPath, error: new Error('A pattern must match at least one file that is not excluded.') };
    }
    for (const file of files) {
      if (!seen.has(file)) yield file;
      seen.add(file);
    }
  }
}

/** Download one file. Never rejects, so a failure waits in the race until its result is given. */
async function download(source: GitHubSource, filePath: string, signal: AbortSignal): Promise<Download> {
  try {
    return { path: filePath, content: await fetchGitHubFile(source, filePath, { signal }) };
  } catch (error) {
    return { path: filePath, error: toError(error) };
  }
}

/**
 * Write a downloaded file right before its result is given, so every file written is a file reported.
 * Takes no signal: an abort would stop the write after the file was emptied.
 */
async function write(downloaded: Download, folder: string): Promise<CopyResult> {
  if ('error' in downloaded) return downloaded;
  const file = path.join(folder, ...downloaded.path.split('/'));
  // A file name in a repository may hold a backslash, which Windows reads as a separator, so `..` can climb out.
  const relative = path.relative(folder, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return { path: downloaded.path, error: new Error('A path must name a file inside the folder.') };
  }
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, downloaded.content);
    return { path: downloaded.path, file };
  } catch (error) {
    return { path: downloaded.path, error: toError(error) };
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
