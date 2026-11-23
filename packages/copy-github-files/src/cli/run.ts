import { copyGitHubFiles } from '../index.ts';
import { parseCommandLine, usage } from './parse.ts';

/** What the command reads from its environment and writes to the console. A caller can give any part instead. */
export interface RunContext {
  /**
   * A token for GitHub's API. Needed for a private repository.
   * @default process.env['GITHUB_TOKEN']
   */
  token: string | undefined;
  /**
   * Print a line of output, such as a file that was copied.
   * @default console.log
   */
  log: (line: string) => void;
  /**
   * Print a line about something that went wrong, such as a file that couldn't be copied.
   * @default console.error
   */
  error: (line: string) => void;
}

/**
 * Run the command with its arguments, and return its exit code.
 *
 * The exit code is 1 when an argument is wrong or a file couldn't be copied, and 0 otherwise.
 *
 * The context gives the token, and where each line goes. Any part left out comes from the environment and the
 * console, as when the command runs on its own.
 *
 * @param args - without `node` and the script, as in `process.argv.slice(2)`.
 * @example
 * const lines: string[] = [];
 * const code = await run(['streetsidesoftware/.github', 'static/sponsor.md'], { log: (line) => lines.push(line) });
 * // lines is ['Copied static/sponsor.md']
 * // code is 0
 */
export async function run(args: string[], context: Partial<RunContext> = {}): Promise<number> {
  const { token, log, error } = withDefaults(context);
  const commandLine = parseCommandLine(args);
  if (typeof commandLine === 'string') {
    error(commandLine);
    return 1;
  }
  if (commandLine.help) {
    log(usage);
    return 0;
  }

  const { repo, paths, output, ref, concurrency, failFast, silent } = commandLine;
  if (!repo || !paths.length) {
    error('Name a repository and at least one file to copy: copy-github-files <owner>/<repo> <path>...');
    return 1;
  }

  let failed = false;
  try {
    const source = { repo, ref, token };
    for await (const result of copyGitHubFiles(source, paths, output, { concurrency })) {
      if ('error' in result) {
        error(`Failed to copy ${result.path}: ${result.error.message}`);
        failed = true;
        if (failFast) break;
      } else if (!silent) {
        log(`Copied ${result.file}`);
      }
    }
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return 1;
  }
  return failed ? 1 : 0;
}

/** Take each part of the context the caller left out from the environment and the console. */
function withDefaults(context: Partial<RunContext>): RunContext {
  return {
    token: context.token ?? (process.env['GITHUB_TOKEN'] || undefined),
    log: context.log ?? ((line) => console.log(line)),
    error: context.error ?? ((line) => console.error(line)),
  };
}
