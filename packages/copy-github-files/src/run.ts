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

  const source: GitHubSource = { repo, ref, token: context.token, fetch: context.fetch };
  const outcomes = await Promise.all(
    [...new Set(paths)].map((filePath) => copyFile(source, filePath, output, context.cwd)),
  );
  let failed = false;
  let changed = false;
  for (const outcome of outcomes) {
    if (outcome.change === 'failed') {
      context.error(outcome.message);
      failed = true;
    } else if (outcome.change !== 'unchanged') {
      context.log(`${outcome.change === 'added' ? 'Added' : 'Updated'} ${outcome.localPath}`);
      changed = true;
    }
  }
  if (!failed && !changed) context.log('No changes.');
  return failed ? 1 : 0;
}

interface CommandLine {
  repo: string;
  paths: string[];
  output: string;
  ref: string | undefined;
  help: boolean;
}

type Outcome = { change: 'added' | 'updated' | 'unchanged'; localPath: string } | { change: 'failed'; message: string };

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

/** Copy one file, unless its local copy already matches. A failure affects only this file. */
async function copyFile(source: GitHubSource, filePath: string, output: string, cwd: string): Promise<Outcome> {
  const fetched = await fetchFile(source, filePath);
  if (!fetched.ok) return { change: 'failed', message: `Failed to copy ${filePath}: ${fetched.reason}` };

  const localPath = path.join(output, ...filePath.split('/'));
  const file = path.resolve(cwd, localPath);
  try {
    const existing = await readExisting(file);
    if (existing && Buffer.from(fetched.content).equals(existing)) return { change: 'unchanged', localPath };
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, fetched.content);
    return { change: existing ? 'updated' : 'added', localPath };
  } catch (error) {
    return { change: 'failed', message: `Failed to write ${localPath}: ${errorMessage(error)}` };
  }
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
