import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { GitHubSource } from './github.ts';
import { fetchFile } from './github.ts';

/** The working folder, token, network and console the command uses. Tests pass their own. */
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

  const { output, ref } = parsed.values;
  const [repo = '', ...paths] = parsed.positionals;
  const inputError = checkInput(repo, paths, output, ref);
  if (inputError) {
    context.error(inputError);
    return 1;
  }

  const files = await fetchAll({ repo, ref, token: context.token, fetch: context.fetch }, paths, context);
  if (!files) return 1;
  return writeAll(files, output, context);
}

interface FetchedFile {
  filePath: string;
  content: Uint8Array;
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

/** Return the message for the first rule the arguments break, or `undefined` when they follow them all. */
function checkInput(repo: string, paths: string[], output: string, ref: string | undefined): string | undefined {
  // An owner has no dots, and a repository name is never `.` or `..`.
  if (!/^[\w-]+\/(?!\.\.?$)[\w.-]+$/.test(repo)) {
    return 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.';
  }
  if (!paths.length) return 'Name at least one file to copy.';
  if (!paths.every(isRepoPath)) {
    return 'A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.';
  }
  if (!output) return 'The --output option must name a folder.';
  if (ref === '') return 'The --ref option must name a branch, tag or commit.';
  return undefined;
}

function isRepoPath(filePath: string): boolean {
  return filePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Fetch every file once, or report each failure and return `undefined`. */
async function fetchAll(
  source: GitHubSource,
  paths: string[],
  context: RunContext,
): Promise<FetchedFile[] | undefined> {
  const results = await Promise.all(
    [...new Set(paths)].map(async (filePath) => ({ filePath, result: await fetchFile(source, filePath) })),
  );
  const files: FetchedFile[] = [];
  for (const { filePath, result } of results) {
    if (result.ok) files.push({ filePath, content: result.content });
    else context.error(`Failed to copy ${filePath}: ${result.reason}`);
  }
  return files.length === results.length ? files : undefined;
}

/**
 * Write the files that differ from their local copies, and return the exit code.
 * Every local copy is read before any is written, so a copy that can't be read stops the command with nothing changed.
 */
async function writeAll(files: FetchedFile[], output: string, context: RunContext): Promise<number> {
  const targets: { localPath: string; file: string; content: Uint8Array; existing: Buffer | undefined }[] = [];
  let failed = false;
  for (const { filePath, content } of files) {
    const localPath = path.join(output, ...filePath.split('/'));
    const file = path.resolve(context.cwd, localPath);
    try {
      targets.push({ localPath, file, content, existing: await readExisting(file) });
    } catch (error) {
      context.error(`Failed to write ${localPath}: ${errorMessage(error)}`);
      failed = true;
    }
  }
  if (failed) return 1;

  let changed = 0;
  for (const { localPath, file, content, existing } of targets) {
    if (existing && Buffer.from(content).equals(existing)) continue;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    } catch (error) {
      context.error(`Failed to write ${localPath}: ${errorMessage(error)}`);
      failed = true;
      continue;
    }
    context.log(`${existing ? 'Updated' : 'Added'} ${localPath}`);
    changed += 1;
  }
  if (failed) return 1;
  if (!changed) context.log('No changes.');
  return 0;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
