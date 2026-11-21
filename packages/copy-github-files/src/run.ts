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
  const commandLine = parseCommandLine(args);
  if (typeof commandLine === 'string') {
    context.error(commandLine);
    return 1;
  }
  if (commandLine.help) {
    context.log(usage);
    return 0;
  }

  const { repo, paths, output, ref } = commandLine;
  const inputError = checkInput(repo, paths);
  if (inputError) {
    context.error(inputError);
    return 1;
  }

  const files = await fetchAll({ repo, ref, token: context.token, fetch: context.fetch }, paths, context);
  if (!files) return 1;
  return writeAll(files, output, context);
}

interface CommandLine {
  repo: string;
  paths: string[];
  output: string;
  ref: string | undefined;
  help: boolean;
}

interface FetchedFile {
  filePath: string;
  content: Uint8Array;
}

const options = {
  output: { type: 'string', default: '.' },
  ref: { type: 'string' },
  help: { type: 'boolean', default: false },
} as const;

/** What the value of each string option must name, for its error message. */
const valueNames: Record<string, string> = {
  output: 'a folder',
  ref: 'a branch, tag or commit',
};

/**
 * Parse the arguments, or return the message for the first option that's wrong.
 * Strict mode would throw instead, with an error that names the option only in Node's own message.
 */
function parseCommandLine(args: string[]): CommandLine | string {
  const { values, positionals, tokens } = parseArgs({
    args,
    options,
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    const optionError = checkOption(token);
    if (optionError) return optionError;
  }
  const [repo = '', ...paths] = positionals;
  // The checks above leave each value with its option's type.
  return {
    repo,
    paths,
    output: values.output as string,
    ref: values.ref as string | undefined,
    help: values.help as boolean,
  };
}

/** Return the message for the rule an option breaks, or `undefined` when it follows them. */
function checkOption(token: {
  name: string;
  rawName: string;
  value?: string | undefined;
  inlineValue?: boolean | undefined;
}): string | undefined {
  const { name, rawName, value, inlineValue } = token;
  if (!Object.hasOwn(options, name)) {
    return `Unknown option ${rawName}. The options are --output, --ref and --help.`;
  }
  if (options[name as keyof typeof options].type === 'boolean') {
    return value === undefined ? undefined : `The ${rawName} option takes no value.`;
  }
  // Without strict mode, parseArgs takes the next argument as the value even when it is another option.
  if (!value || (!inlineValue && value.length > 1 && value.startsWith('-'))) {
    return `The ${rawName} option must name ${valueNames[name]}.`;
  }
  return undefined;
}

/** Return the message for the first rule the arguments break, or `undefined` when they follow them all. */
function checkInput(repo: string, paths: string[]): string | undefined {
  // An owner has no dots, and a repository name is never `.` or `..`.
  if (!/^[\w-]+\/(?!\.\.?$)[\w.-]+$/.test(repo)) {
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
