#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { findPackages } from './lib/packages.ts';
import { formatFile } from './lib/prettier.ts';
import { PACKAGES_CSV_FILE, packagesCsv, README_GLOBS } from './lib/readme.ts';

const HELP = `Usage: gen-readme [options]

Writes ${PACKAGES_CSV_FILE}, the table of published packages the root README injects.
\`pnpm run build:readme\` runs this, then inject-markdown and prettier on ${README_GLOBS.join(' and ')}.

Options:
  --check     Don't write. Exit with a non-zero status if ${PACKAGES_CSV_FILE} or any README is out of date,
              that is, if \`pnpm run build:readme\` would change it.
  -h, --help  Show this help message.
`;

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const csvPath = Path.join(REPO_ROOT_DIR, PACKAGES_CSV_FILE);
  const csv = packagesCsv(await findPackages());
  const currentCsv = await fs.readFile(csvPath, 'utf8').catch(() => '');

  if (!values.check) {
    if (csv !== currentCsv) {
      await fs.mkdir(Path.dirname(csvPath), { recursive: true });
      await fs.writeFile(csvPath, csv, 'utf8');
      console.error('Updated %s', PACKAGES_CSV_FILE);
    }
    return;
  }

  // The READMEs inject the CSV on disk, so they can only be checked once it is current.
  const stale = csv !== currentCsv ? [PACKAGES_CSV_FILE] : await staleReadmes();
  if (stale.length) {
    for (const file of stale) console.error('%s is out of date.', file);
    console.error('Run `pnpm run build:readme`.');
    process.exitCode = 1;
  }
}

/** READMEs whose injected sections differ from what `build:readme` would write, given the files on disk. */
async function staleReadmes(): Promise<string[]> {
  const outDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'gen-readme-'));
  try {
    const result = spawnSync(
      'pnpm',
      ['exec', 'inject-markdown', '--no-summary', '--silent', '--output-dir', outDir, ...README_GLOBS],
      { cwd: REPO_ROOT_DIR, stdio: 'inherit', shell: process.platform === 'win32' },
    );
    if (result.status !== 0) throw new Error('inject-markdown failed');

    const stale: string[] = [];
    for await (const relFile of fs.glob(README_GLOBS, { cwd: REPO_ROOT_DIR })) {
      const filepath = Path.join(REPO_ROOT_DIR, relFile);
      const injected = await fs.readFile(Path.join(outDir, relFile), 'utf8');
      const expected = await formatFile(injected, filepath);
      if (expected !== (await fs.readFile(filepath, 'utf8'))) stale.push(relFile.replaceAll('\\', '/'));
    }
    return stale.sort();
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

await main();
