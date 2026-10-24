#!/usr/bin/env node

import fs from 'node:fs/promises';
import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { readPackageJson } from './lib/package-json-util.ts';
import { findPackages } from './lib/packages.ts';
import type { Manifest, ReleasePleaseConfig } from './lib/release-please.ts';
import { CONFIG_FILE, formatJson, genConfig, genManifest, MANIFEST_FILE, readJsonFile } from './lib/release-please.ts';

const HELP = `Usage: update-release-please-config [options]

Updates ${CONFIG_FILE} and ${MANIFEST_FILE} from the root package and packages/*:
- adds a config entry for each package, private ones included
- adds each package missing from the manifest at its package.json version; existing entries never change
- drops each release-as once the manifest shows that version was released

Run by the Update Release Please Config workflow on main. Release state, not lint.

Options:
  --check     Don't write; exit with a non-zero status if either file is out of date.
  -h, --help  Show this help message.
`;

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const root = { dir: '.', packageJson: await readPackageJson(Path.join(REPO_ROOT_DIR, 'package.json')) };
  const packages = await findPackages();
  const currentManifest = (await readJsonFile<Manifest>(MANIFEST_FILE)) ?? {};
  const currentConfig = await readJsonFile<ReleasePleaseConfig>(CONFIG_FILE);

  const manifest = genManifest(root, packages, currentManifest);
  const config = genConfig(root, packages, currentConfig, manifest);

  let outOfDate = false;
  for (const [file, value] of [
    [MANIFEST_FILE, manifest],
    [CONFIG_FILE, config],
  ] as const) {
    const filePath = Path.join(REPO_ROOT_DIR, file);
    const current = await fs.readFile(filePath, 'utf8').catch(() => '');
    const next = formatJson(value);
    if (current === next) continue;
    if (values.check) {
      console.error('%s is out of date. Run `pnpm run release-please-config`.', file);
      outOfDate = true;
      continue;
    }
    await fs.writeFile(filePath, next, 'utf8');
    console.error('Updated %s', file);
  }

  if (outOfDate) process.exitCode = 1;
}

await main();
