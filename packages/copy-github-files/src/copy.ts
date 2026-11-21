import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FetchOptions, GitHubSource } from './github.ts';
import { checkSource, fetchGitHubFile } from './github.ts';

/** What happened to one file: the local file it was written to, or why it wasn't copied. */
export type CopyResult = { path: string; file: string } | { path: string; error: Error };

/**
 * Copy files from a GitHub repository into a folder. Each file keeps its path from the root of the repository.
 *
 * Gives one result per path, in the order of `paths`, once that file is written or has failed. A failed file doesn't
 * stop the others. To stop at the first failure, break out of the loop or abort the signal.
 *
 * @param source - The repository, and the ref and token to read it with.
 * @param paths - The files' paths from the root of the repository, such as `static/sponsor.md`.
 * @param folder - The folder to write the files below.
 * @param options - Options, such as a signal to stop copying.
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
  options: FetchOptions = {},
): AsyncIterable<CopyResult> {
  checkSource(source);
  const { signal } = options;
  const seen = new Set<string>();
  for await (const filePath of paths) {
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    yield await copyFile(source, filePath, folder, signal);
  }
}

async function copyFile(
  source: GitHubSource,
  filePath: string,
  folder: string,
  signal: AbortSignal | undefined,
): Promise<CopyResult> {
  signal?.throwIfAborted();
  try {
    const content = await fetchGitHubFile(source, filePath, { signal });
    const file = path.join(folder, ...filePath.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, { signal });
    return { path: filePath, file };
  } catch (error) {
    // An abort stops the whole copy, not just this file.
    signal?.throwIfAborted();
    return { path: filePath, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
