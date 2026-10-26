#!/usr/bin/env node

import fs from 'node:fs/promises';
import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { readPackageJson } from './lib/package-json-util.ts';
import { findPackages } from './lib/packages.ts';
import type { Manifest, ReleasePleaseConfig } from './lib/release-please.ts';
import { CONFIG_FILE, formatJson, genConfig, genManifest, MANIFEST_FILE, readJsonFile } from './lib/release-please.ts';
import { formatPublished, prunePublished, PUBLISHED_FILE, readPublished } from './lib/trusted-publishing.ts';

const HELP = `Usage: update-release-please-config [options]

Updates ${CONFIG_FILE}, ${MANIFEST_FILE} and ${PUBLISHED_FILE} from the root package and packages/*:
- adds a config entry for each package, private ones included
- adds each package missing from the manifest at its package.json version; existing versions never change
- drops each release-as once the manifest shows that version was released
- drops the manifest and ${PUBLISHED_FILE} entries of packages that no longer exist, except a false in ${PUBLISHED_FILE}

Run by the Update Release Please Config workflow on main. Release state, not lint.

Options:
  --check     Don't write; exit with a non-zero status if any of the files is out of date.
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
  const names = packages.flatMap((p) => (p.packageJson.name ? [p.packageJson.name] : []));
  const published = prunePublished(await readPublished(), names);

  let outOfDate = false;
  for (const [file, next] of [
    [MANIFEST_FILE, formatJson(manifest)],
    [CONFIG_FILE, formatJson(config)],
    [PUBLISHED_FILE, formatPublished(published)],
  ] as const) {
    const filePath = Path.join(REPO_ROOT_DIR, file);
    const current = await fs.readFile(filePath, 'utf8').catch(() => '');
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
