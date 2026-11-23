import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FetchOptions, GitHubSource } from '../github/index.ts';
import { checkSource, fetchGitHubFile } from '../github/index.ts';

/** What happened to one file: the local file it was written to, or why it wasn't copied. */
export type CopyResult = { path: string; file: string } | { path: string; error: Error };

export interface CopyOptions extends FetchOptions {
  /**
   * How many files to download at once.
   * @default 8
   */
  concurrency?: number | undefined;
}

const defaultConcurrency = 8;

/**
 * Copy files from a GitHub repository into a folder. Each file keeps its path from the root of the repository.
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
 * @param paths - from the root of the repository, such as `static/sponsor.md`.
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
  options.signal?.throwIfAborted();

  // Stops every download still running when the loop ends early, through a break, a return or a throw.
  const internal = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, internal.signal]) : internal.signal;
  const pending = pullOnce(paths);
  const running = new Set<Promise<Finished>>();
  try {
    for (;;) {
      while (running.size < concurrency) {
        const next = pending.next();
        if (next.done) break;
        running.add(start(source, next.value, signal));
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
    pending.return();
  }
}

type Download = { path: string; content: Uint8Array } | { path: string; error: Error };
type Finished = { task: Promise<Finished>; downloaded: Download };

/** Start downloading a file. The result names its own task, so the race can remove it from the running set. */
function start(source: GitHubSource, filePath: string, signal: AbortSignal): Promise<Finished> {
  const task: Promise<Finished> = download(source, filePath, signal).then((downloaded) => ({ task, downloaded }));
  return task;
}

/** Read the paths only as they're needed, skipping a path seen before. */
function* pullOnce(paths: Iterable<string>): Generator<string, void> {
  const seen = new Set<string>();
  for (const filePath of paths) {
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    yield filePath;
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
