#!/usr/bin/env node
import { run } from './cli/index.ts';

if (import.meta.main) process.exitCode = await main();

async function main(): Promise<number> {
  /**
   * Whether the reader closed the pipe early, as `head` does. Output after that is dropped, and the exit code still
   * tells what was found.
   */
  let closed = false;
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') throw error;
    closed = true;
  });

  return run(process.argv.slice(2), {
    stdin: process.stdin,
    stdout: (text) => {
      if (!closed) process.stdout.write(text);
    },
    stderr: (text) => process.stderr.write(text),
  });
}
