#!/usr/bin/env node
import { run } from './run.ts';

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  token: process.env['GITHUB_TOKEN'] || undefined,
  fetch: globalThis.fetch,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
