#!/usr/bin/env node

import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { EXAMPLE_GLOB, findExamples, OUTPUT_FILE, updateExampleOutput } from './lib/examples.ts';

const HELP = `Usage: run-examples [options]

Runs each ${EXAMPLE_GLOB} with Node and writes what it prints to ${OUTPUT_FILE} next to it.
An example that prints nothing gets no ${OUTPUT_FILE}.
A package's README injects both. \`pnpm run build:readme\` runs this; build the packages first.

Options:
  -h, --help  Show this help message.
`;

async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log(HELP);
    return;
  }

  for (const example of await findExamples()) {
    if (await updateExampleOutput(Path.join(REPO_ROOT_DIR, example))) {
      console.error('Updated %s', Path.posix.join(Path.posix.dirname(example), OUTPUT_FILE));
    }
  }
}

await main();
