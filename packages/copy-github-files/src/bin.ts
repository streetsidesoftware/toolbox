#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';

import { copyGitHubFiles } from './copy.ts';

/** The working folder, token and console the command uses. Tests pass their own. */
export interface RunContext {
  cwd: string;
  /** The value of `GITHUB_TOKEN`. */
  token: string | undefined;
  log: (line: string) => void;
  error: (line: string) => void;
}

export const usage: string = `Usage: copy-github-files <owner>/<repo> <path>... [options]

Copy files from a GitHub repository. Each file keeps its path from the root of the repository.

Options:
  --output <dir>  The folder to write the files below. Default: the current folder.
  --ref <ref>     The branch, tag or commit to copy from. Default: the repository's default branch.
  --fail-fast     Stop at the first file that fails. Without it, the other files are still copied.
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

  const { repo, paths, output, ref, failFast } = commandLine;
  if (!paths.length) {
    context.error('Name at least one file to copy.');
    return 1;
  }

  const folder = path.resolve(context.cwd, output);
  let failed = false;
  try {
    for await (const result of copyGitHubFiles({ repo, ref, token: context.token }, paths, folder)) {
      if ('error' in result) {
        context.error(`Failed to copy ${result.path}: ${result.error.message}`);
        failed = true;
        if (failFast) break;
      } else {
        context.log(`Copied ${path.join(output, ...result.path.split('/'))}`);
      }
    }
  } catch (error) {
    context.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  return failed ? 1 : 0;
}

interface CommandLine {
  repo: string;
  paths: string[];
  output: string;
  ref: string | undefined;
  failFast: boolean;
  help: boolean;
}

const options = {
  output: { type: 'string', default: '.' },
  ref: { type: 'string' },
  'fail-fast': { type: 'boolean', default: false },
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
    failFast: values['fail-fast'] as boolean,
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
    return `Unknown option ${rawName}. The options are --output, --ref, --fail-fast and --help.`;
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

// Last, so every constant above is set when the command runs.
if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2), {
    cwd: process.cwd(),
    token: process.env['GITHUB_TOKEN'] || undefined,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  });
}
