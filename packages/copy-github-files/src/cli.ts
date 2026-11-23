#!/usr/bin/env node
import { run } from './cli/index.ts';

export type { RunContext } from './cli/index.ts';
export { run } from './cli/index.ts';

if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2));
}
