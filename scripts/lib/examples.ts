import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import Path from 'node:path';
import { promisify } from 'node:util';

import { REPO_ROOT_DIR } from './consts.ts';
import { compare } from './packages.ts';

/** A package's README examples, relative to the repo root. Each folder is one example. */
export const EXAMPLE_GLOB = 'packages/*/examples/*/example.ts';

/** The file next to an example that holds what it printed. */
export const OUTPUT_FILE = 'output.md';

const execFileAsync = promisify(execFile);

/** Every example, relative to the root with `/` separators, sorted. */
export async function findExamples(rootDir: string = REPO_ROOT_DIR): Promise<string[]> {
  const found: string[] = [];
  for await (const file of fs.glob(EXAMPLE_GLOB, { cwd: rootDir })) found.push(file.replaceAll('\\', '/'));
  return found.sort(compare);
}

/** What an example prints, run with Node in its own folder, the way a user would run it. No shell is involved. */
export async function runExample(file: string): Promise<string> {
  const { stdout } = await execFileAsync(process.execPath, [Path.basename(file)], { cwd: Path.dirname(file) });
  return stdout;
}

/**
 * Run an example and write what it printed to its output file.
 * @returns whether the output file changed.
 */
export async function updateExampleOutput(file: string): Promise<boolean> {
  const output = await runExample(file);
  const outputFile = Path.join(Path.dirname(file), OUTPUT_FILE);
  const current = await fs.readFile(outputFile, 'utf8').catch(() => undefined);
  if (output === current) return false;
  await fs.writeFile(outputFile, output, 'utf8');
  return true;
}
