#!/usr/bin/env node

import { parseArgs } from 'node:util';

import {
  apiReferenceFile,
  apiReferenceMarker,
  ENTRY_FILE,
  findApiReferencePackages,
  updateApiReference,
} from './lib/api-reference.ts';

const HELP = `Usage: gen-api-reference [options]

Writes the function reference of each package whose README injects it, such as
${apiReferenceFile('packages/markdown-toolkit')} for a README with
${apiReferenceMarker('packages/markdown-toolkit')}

It lists the functions ${ENTRY_FILE} exports, grouped by the @category tag in their JSDoc.
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
    if (await updateApiReference(dir)) console.error('Updated %s', apiReferenceFile(dir));
  }
}

await main();
