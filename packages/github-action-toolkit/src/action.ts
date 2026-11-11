import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { EOL } from 'node:os';

/**
 * Read one of the action's inputs.
 *
 * The value comes back without the whitespace around it. An input without a value gives `''`.
 *
 * @param name - the input's name in `action.yaml`. Upper and lower case are the same.
 * @example
 * // The workflow step has `with: { dry-run: true }`.
 * getInput('dry-run');
 * // 'true'
 */
export function getInput(name: string): string {
  const value = process.env[`INPUT_${name.replaceAll(' ', '_').toUpperCase()}`] || '';
  return value.trim();
}

/**
 * Set one of the action's outputs.
 *
 * Every output is a string, so a number or boolean is stored as its text, such as `'3'` or `'true'`. A string can
 * span several lines.
 *
 * The runner names the file that holds the outputs in the `GITHUB_OUTPUT` environment variable. Outside a
 * workflow run, set it yourself, or the call throws.
 *
 * @param name - the output's name in `action.yaml`.
 * @example
 * setOutput('updated', 3);
 * // A later step reads '3' from `steps.<step id>.outputs.updated`.
 */
export function setOutput(name: string, value: string | number | boolean): void {
  // The runner takes everything between the two delimiter lines as the value, so a value can span lines.
  // Each delimiter has a new random UUID, so a value never holds it and ends early.
  const delimiter = `delimiter_${randomUUID()}`;
  appendFileSync(runnerFile('GITHUB_OUTPUT'), `${name}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`);
}

/**
 * Add Markdown to the end of the job summary.
 *
 * The job summary shows on the workflow run's page. The Markdown goes in as given, right after what the summary
 * already holds, so end it with a newline.
 *
 * The runner names the summary's file in the `GITHUB_STEP_SUMMARY` environment variable. Outside a workflow run,
 * set it yourself, or the call throws.
 *
 * @example
 * appendJobSummary('## Updated\n\n- actions/checkout\n');
 * // The workflow run's page shows the heading "Updated" above a list of one item.
 */
export function appendJobSummary(markdown: string): void {
  appendFileSync(runnerFile('GITHUB_STEP_SUMMARY'), markdown);
}

/**
 * Report an error to the runner and make the step fail.
 *
 * The message shows as an error in the step's log and on the workflow run's page.
 *
 * The process keeps running. Its exit code is set to 1, so the step fails when the process ends.
 *
 * @example
 * setFailed('No workflow files found');
 * // The step's log shows "Error: No workflow files found", and the step fails when the process ends.
 */
export function setFailed(message: string): void {
  process.exitCode = 1;
  console.log(`::error::${escapeCommandData(message)}`);
}

/**
 * Return the path of a file the runner reads after the step, from the environment variable that names it.
 * Throw when the variable isn't set, since there is no file to write to.
 */
function runnerFile(variable: string): string {
  const file = process.env[variable];
  if (!file) {
    throw new Error(`The ${variable} environment variable is not set. The GitHub Actions runner sets it for a step.`);
  }
  return file;
}

/**
 * Encode text for a workflow command, which is one line of output.
 * The runner decodes `%` escapes in it, so a `%` in the text is encoded too.
 */
function escapeCommandData(data: string): string {
  return data.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}
