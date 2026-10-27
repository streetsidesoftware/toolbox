#!/usr/bin/env node

import fs from 'node:fs/promises';
import Path from 'node:path';

// Not from new-package.ts: that imports @streetsidesoftware/placeholders, which needs a build, and autofix runs this without one.
import { REPO_ROOT_DIR, ROOT_LICENSE_FILE, TEMPLATE_DIR } from './lib/consts.ts';
import { syncLicense } from './lib/license.ts';
import { fixPackageJson } from './lib/package-json-util.ts';

const HELP = `Usage: fix-package-json [options]

Fixes up the packages/*, internal/* and scripts package.json files (name, repository, keywords, publishConfig,
and engines.node, copied from the root package.json), and the keywords and engines.node of the new-package
template's package.json. Also copies the root LICENSE into each packages/* folder.

Options:
  --dry-run   Report which files need fixing without writing changes; exits with a
              non-zero status if any file needs fixing.
  -h, --help  Show this help message.
`;

async function main() {
  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    console.log(HELP);
    return;
  }

  const dryRun = process.argv.includes('--dry-run');

  console.error('Fixing package.json files...');
  if (dryRun) {
    console.error('Running in dry run mode, no changes will be written.');
  }

  let needsFix = false;
  for await (const relFilePath of fs.glob(
    ['packages/*/package.json', 'internal/*/package.json', 'scripts/package.json'],
    {
      cwd: REPO_ROOT_DIR,
    },
  )) {
    const fixed = await fixPackageJson(Path.join(REPO_ROOT_DIR, relFilePath), { dryRun });
    needsFix ||= fixed;
  }
  needsFix ||= await fixPackageJson(Path.join(TEMPLATE_DIR, 'package.json'), { dryRun, template: true });

  const licenseText = await fs.readFile(ROOT_LICENSE_FILE, 'utf-8');
  for await (const relFilePath of fs.glob('packages/*/package.json', { cwd: REPO_ROOT_DIR })) {
    const licenseFile = Path.join(REPO_ROOT_DIR, Path.dirname(relFilePath), 'LICENSE');
    if (await syncLicense(licenseFile, licenseText, { dryRun })) {
      console.error('LICENSE differs from the root one: %s', Path.relative(REPO_ROOT_DIR, licenseFile));
      needsFix = true;
    }
  }

  if (dryRun && needsFix) {
    console.error('One or more files need fixing. Run `pnpm exec fix-package-json` to fix them.');
    process.exitCode = 1;
    return;
  }

  console.error('Done.');
}

await main();
