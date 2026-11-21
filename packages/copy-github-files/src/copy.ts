import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FetchOptions, GitHubSource } from './github.ts';
import { checkSource, fetchGitHubFile } from './github.ts';

/** What happened to one file: the local file it was written to, or why it wasn't copied. */
export type CopyResult = { path: string; file: string } | { path: string; error: Error };

/** Options for copying files from GitHub. */
export interface CopyOptions extends FetchOptions {
  /** How many files to download at once. Defaults to 8. */
  concurrency?: number | undefined;
}

const defaultConcurrency = 8;

/**
 * Copy files from a GitHub repository into a folder. Each file keeps its path from the root of the repository.
 *
 * Downloads several files at once, and gives each file's result as soon as that file is written or has failed, so
 * the results can come in any order. A failed file doesn't stop the others. To stop early, break out of the loop or
 * abort the signal: downloads still running are stopped, and only the files already given as results are written.
 *
 * @param source - The repository, and the ref and token to read it with.
 * @param paths - The files' paths from the root of the repository, such as `static/sponsor.md`.
 * @param folder - The folder to write the files below.
 * @param options - Options, such as how many files to download at once, and a signal to stop copying.
 * @returns The result for each file.
 *
 * @example
 * for await (const result of copyGitHubFiles({ repo: 'streetsidesoftware/.github' }, ['static/sponsor.md'], '.')) {
 *   if ('error' in result) console.error(`${result.path}: ${result.error.message}`);
 * }
 */
export async function* copyGitHubFiles(
  source: GitHubSource,
  paths: Iterable<string> | AsyncIterable<string>,
  folder: string,
  options: CopyOptions = {},
): AsyncIterable<CopyResult> {
  checkSource(source);
  const concurrency = options.concurrency ?? defaultConcurrency;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('The concurrency must be a whole number of at least 1.');
  }
  options.signal?.throwIfAborted();

  // Stops every download still running when the loop ends early, through a break, a return or a throw.
  const internal = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, internal.signal]) : internal.signal;
  const pending = pullOnce(paths);
  const running = new Set<Promise<Download>>();
  try {
    let exhausted = false;
    for (;;) {
      while (!exhausted && running.size < concurrency) {
        const next = await pending.next();
        if (next.done) exhausted = true;
        else running.add(download(source, next.value, signal));
      }
      if (!running.size) return;
      const [finished, downloaded] = await Promise.race(
        [...running].map((task) => task.then((result) => [task, result] as const)),
      );
      running.delete(finished);
      options.signal?.throwIfAborted();
      yield await write(downloaded, folder, signal);
      options.signal?.throwIfAborted();
    }
  } finally {
    internal.abort();
    await pending.return();
  }
}

type Download = { path: string; content: Uint8Array } | { path: string; error: Error };

/** Read the paths only as they're needed, skipping a path seen before. */
async function* pullOnce(paths: Iterable<string> | AsyncIterable<string>): AsyncGenerator<string, void> {
  const seen = new Set<string>();
  for await (const filePath of paths) {
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

/** Write a downloaded file right before its result is given, so every file written is a file reported. */
async function write(downloaded: Download, folder: string, signal: AbortSignal): Promise<CopyResult> {
  if ('error' in downloaded) return downloaded;
  const file = path.join(folder, ...downloaded.path.split('/'));
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, downloaded.content, { signal });
    return { path: downloaded.path, file };
  } catch (error) {
    return { path: downloaded.path, error: toError(error) };
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
