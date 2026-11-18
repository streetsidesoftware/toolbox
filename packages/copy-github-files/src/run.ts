import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { fetchFile } from './github.ts';

/** What the command reaches outside itself through, so tests can stand in for it. */
export interface RunContext {
  cwd: string;
  /** The value of `GITHUB_TOKEN`. */
  token: string | undefined;
  fetch: typeof globalThis.fetch;
  log: (line: string) => void;
  error: (line: string) => void;
}

export const usage: string = `Usage: copy-github-files <owner>/<repo> <path>... [options]

Copy files from a GitHub repository. Each file keeps its path from the root of the repository.
A file is written only when it differs from the local copy.

Options:
  --output <dir>  The folder to write the files below. Default: the current folder.
  --ref <ref>     The branch, tag or commit to copy from. Default: the repository's default branch.
  --help          Show this help.

When GITHUB_TOKEN is set, it authenticates the requests. A private repository needs it.`;

/** Run the command with its arguments, and return the exit code. */
export async function run(args: string[], context: RunContext): Promise<number> {
  const parsed = parseCommandLine(args);
  if (!parsed) {
    context.error(usage);
    return 1;
  }
  if (parsed.values.help) {
    context.log(usage);
    return 0;
  }

  const [repo = '', ...paths] = parsed.positionals;
  const inputError = checkInput(repo, paths);
  if (inputError) {
    context.error(inputError);
    return 1;
  }

  const source = { repo, ref: parsed.values.ref, token: context.token, fetch: context.fetch };
  const results = await Promise.all(
    [...new Set(paths)].map(async (filePath) => ({ filePath, result: await fetchFile(source, filePath) })),
  );

  const files: { filePath: string; content: Uint8Array }[] = [];
  for (const { filePath, result } of results) {
    if (result.ok) files.push({ filePath, content: result.content });
    else context.error(`Failed to copy ${filePath}: ${result.reason}`);
  }
  // Nothing is written unless every file was read, so the local copies never end up half updated.
  if (files.length < results.length) return 1;

  let changed = 0;
  for (const { filePath, content } of files) {
    const localPath = path.join(parsed.values.output, ...filePath.split('/'));
    const status = await writeIfChanged(path.resolve(context.cwd, localPath), content);
    if (status === 'unchanged') continue;
    context.log(`${status === 'added' ? 'Added' : 'Updated'} ${localPath}`);
    changed += 1;
  }
  if (!changed) context.log('No changes.');
  return 0;
}

/** Parse the arguments, or return `undefined` when they hold an unknown option or an option without its value. */
function parseCommandLine(args: string[]) {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: {
        output: { type: 'string', default: '.' },
        ref: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    });
  } catch {
    return undefined;
  }
}

/** Return the message for the first rule the repository or paths break, or `undefined` when they follow them all. */
function checkInput(repo: string, paths: string[]): string | undefined {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.';
  }
  if (!paths.length) return 'Name at least one file to copy.';
  if (!paths.every(isRepoPath)) {
    return 'A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.';
  }
  return undefined;
}

function isRepoPath(filePath: string): boolean {
  return filePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function writeIfChanged(file: string, content: Uint8Array): Promise<'added' | 'updated' | 'unchanged'> {
  const existing = await readExisting(file);
  if (existing && Buffer.from(content).equals(existing)) return 'unchanged';
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return existing ? 'updated' : 'added';
}

/** Read a file, or return `undefined` when there's none. */
async function readExisting(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
