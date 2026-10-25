#!/usr/bin/env node

import fs from 'node:fs/promises';
import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { findPackages } from './lib/packages.ts';
import { PACKAGES_CSV_FILE, packagesCsv, README_GLOBS } from './lib/readme.ts';

const HELP = `Usage: gen-readme [options]

Writes ${PACKAGES_CSV_FILE}, the table of packages the root README injects.
\`pnpm run build:readme\` runs this, then inject-markdown and prettier on ${README_GLOBS.join(' and ')}.

Options:
  -h, --help  Show this help message.
`;

async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const csvPath = Path.join(REPO_ROOT_DIR, PACKAGES_CSV_FILE);
  const csv = packagesCsv(await findPackages());
  const currentCsv = await fs.readFile(csvPath, 'utf8').catch(() => '');
  if (csv === currentCsv) return;

  await fs.mkdir(Path.dirname(csvPath), { recursive: true });
  await fs.writeFile(csvPath, csv, 'utf8');
  console.error('Updated %s', PACKAGES_CSV_FILE);
}

await main();
