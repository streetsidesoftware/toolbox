#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { copyGitHubFiles } from './copy.ts';
import type { GitHubSource } from './github.ts';
import { checkSource } from './github.ts';
import { findFiles, isExcluded, isPattern } from './glob.ts';

/** What the command reads from its environment and writes to the console, given by the caller instead. */
export interface RunContext {
  /** A token for GitHub's API, such as the value of `GITHUB_TOKEN`. Needed for a private repository. */
  token: string | undefined;
  /** Print a line of output, such as a file that was copied. */
  log: (line: string) => void;
  /** Print a line about something that went wrong, such as a file that couldn't be copied. */
  error: (line: string) => void;
}

/** The help the command prints for `--help`. */
export const usage: string = `Usage: copy-github-files <owner>/<repo> <path>... [options]

Copy files from a GitHub repository. Each file keeps its path from the root of the repository.

A path with *, ?, [ or { in it is a pattern, such as 'static/img/*.png'. Each segment matches the names in one
folder, and a pattern doesn't reach into subfolders. Quote a pattern, so the shell doesn't expand it.

Options:
  --output <dir>     The folder to write the files below. Default: the current folder.
  --ref <ref>        The branch, tag or commit to copy from. Default: the repository's default branch.
  --exclude <glob>   Skip the files a pattern finds that match <glob>, as in .gitignore. A <glob> that starts with !
                     keeps the files it matches. Give it once per glob.
  --concurrency <n>  How many files to download at once. Default: 8.
  --fail-fast        Stop at the first file that fails. Without it, the other files are still copied.
  --silent           Don't list the copied files. Failures are still shown.
  --help             Show this help.

When GITHUB_TOKEN is set, it authenticates the requests. A private repository needs it.`;

/**
 * Run the command with its arguments, and return its exit code.
 *
 * The exit code is 1 when an argument is wrong or a file couldn't be copied, and 0 otherwise.
 *
 * Every line goes to the context's `log` or `error`, never straight to the console.
 *
 * @param args - without `node` and the script, as in `process.argv.slice(2)`.
 * @example
 * const code = await run(['streetsidesoftware/.github', 'static/sponsor.md'], {
 *   token: process.env['GITHUB_TOKEN'],
 *   log: (line) => console.log(line),
 *   error: (line) => console.error(line),
 * });
 * // Prints: Copied static/sponsor.md
 * // code is 0
 */
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

  const { repo, paths, output, ref, exclude, concurrency, failFast, silent } = commandLine;
  if (!repo || !paths.length) {
    context.error('Name a repository and at least one file to copy: copy-github-files <owner>/<repo> <path>...');
    return 1;
  }

  let failed = false;
  try {
    const source = { repo, ref, token: context.token };
    checkSource(source);
    const found = await findPaths(source, paths, exclude, context, failFast);
    if (found.failed && failFast) return 1;
    failed = found.failed;
    for await (const result of copyGitHubFiles(source, found.files, output, { concurrency })) {
      if ('error' in result) {
        context.error(`Failed to copy ${result.path}: ${result.error.message}`);
        failed = true;
        if (failFast) break;
      } else if (!silent) {
        context.log(`Copied ${result.file}`);
      }
    }
    for (const pattern of found.unmatched) {
      context.error(`No file matches ${pattern}`);
      failed = true;
    }
  } catch (error) {
    context.error(toMessage(error));
    return 1;
  }
  return failed ? 1 : 0;
}

/**
 * Replace each pattern among the paths with the files it matches that aren't excluded.
 * A pattern whose folders can't be read is reported, and with `failFast` stops the search.
 */
async function findPaths(
  source: GitHubSource,
  paths: string[],
  exclude: string[],
  context: RunContext,
  failFast: boolean,
): Promise<{ files: string[]; unmatched: string[]; failed: boolean }> {
  const files: string[] = [];
  const unmatched: string[] = [];
  let failed = false;
  for (const repoPath of paths) {
    if (!isPattern(repoPath)) {
      files.push(repoPath);
      continue;
    }
    try {
      const matches = (await findFiles(source, repoPath)).filter((file) => !isExcluded(file, exclude));
      if (!matches.length) unmatched.push(repoPath);
      for (const file of matches) files.push(file);
    } catch (error) {
      context.error(`Failed to find files for ${repoPath}: ${toMessage(error)}`);
      failed = true;
      if (failFast) break;
    }
  }
  return { files, unmatched, failed };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface CommandLine {
  repo: string;
  paths: string[];
  output: string;
  ref: string | undefined;
  exclude: string[];
  concurrency: number | undefined;
  failFast: boolean;
  silent: boolean;
  help: boolean;
}

const options = {
  output: { type: 'string', default: '.' },
  ref: { type: 'string' },
  exclude: { type: 'string', multiple: true },
  concurrency: { type: 'string' },
  'fail-fast': { type: 'boolean', default: false },
  silent: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} as const;

/** The rule for each string option's value, for its error message. */
const valueRules: Record<string, string> = {
  output: 'must name a folder',
  ref: 'must name a branch, tag or commit',
  exclude: 'must name a file or folder, such as banner.png',
  concurrency: 'must be a whole number of at least 1',
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
    exclude: (values.exclude as string[] | undefined) ?? [],
    concurrency: values.concurrency === undefined ? undefined : Number(values.concurrency),
    failFast: values['fail-fast'] as boolean,
    silent: values.silent as boolean,
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
    return `Unknown option ${rawName}. The options are --output, --ref, --exclude, --concurrency, --fail-fast, --silent and --help.`;
  }
  if (options[name as keyof typeof options].type === 'boolean') {
    return value === undefined ? undefined : `The ${rawName} option takes no value.`;
  }
  // Without strict mode, parseArgs takes the next argument as the value even when it is another option.
  if (
    !value ||
    (!inlineValue && value.length > 1 && value.startsWith('-')) ||
    (name === 'concurrency' && !/^[1-9]\d*$/.test(value))
  ) {
    return `The ${rawName} option ${valueRules[name]}.`;
  }
  return undefined;
}

// Last, so every constant above is set when the command runs.
if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2), {
    token: process.env['GITHUB_TOKEN'] || undefined,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  });
}
