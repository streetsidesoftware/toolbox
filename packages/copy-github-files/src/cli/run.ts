import { copyGitHubFiles } from '../index.ts';
import { parseCommandLine, usage } from './parse.ts';

/** What the command reads from its environment and writes to the console, given by the caller instead. */
export interface RunContext {
  /** A token for GitHub's API, such as the value of `GITHUB_TOKEN`. Needed for a private repository. */
  token: string | undefined;
  /** Print a line of output, such as a file that was copied. */
  log: (line: string) => void;
  /** Print a line about something that went wrong, such as a file that couldn't be copied. */
  error: (line: string) => void;
}

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

  const { repo, paths, output, ref, concurrency, failFast, silent } = commandLine;
  if (!repo || !paths.length) {
    context.error('Name a repository and at least one file to copy: copy-github-files <owner>/<repo> <path>...');
    return 1;
  }

  let failed = false;
  try {
    const source = { repo, ref, token: context.token };
    for await (const result of copyGitHubFiles(source, paths, output, { concurrency })) {
      if ('error' in result) {
        context.error(`Failed to copy ${result.path}: ${result.error.message}`);
        failed = true;
        if (failFast) break;
      } else if (!silent) {
        context.log(`Copied ${result.file}`);
      }
    }
  } catch (error) {
    context.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  return failed ? 1 : 0;
}
