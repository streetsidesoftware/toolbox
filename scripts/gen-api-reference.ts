#!/usr/bin/env node

import Path from 'node:path';
import { parseArgs } from 'node:util';

import {
  API_REFERENCE_FILE,
  API_REFERENCE_MARKER,
  ENTRY_FILE,
  findApiReferencePackages,
  updateApiReference,
} from './lib/api-reference.ts';

const HELP = `Usage: gen-api-reference [options]

Writes ${API_REFERENCE_FILE}, the function reference, in each package whose README injects it with
${API_REFERENCE_MARKER}

It lists the functions and constants ${ENTRY_FILE} exports, grouped by the @category tag in their JSDoc.
\`pnpm run build:readme\` runs this; build the packages first.

Options:
  -h, --help  Show this help message.
`;

async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log(HELP);
    return;
  }

  for (const dir of await findApiReferencePackages()) {
    if (await updateApiReference(dir)) console.error('Updated %s', Path.posix.join(dir, API_REFERENCE_FILE));
  }
}

await main();
