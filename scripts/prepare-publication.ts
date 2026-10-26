#!/usr/bin/env node

import fs from 'node:fs/promises';
import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { stringifyPackageJson } from './lib/package-json-util.ts';
import { currentPackageName, findPackages } from './lib/packages.ts';
import { makePublic, PRIVATE_SUFFIX } from './lib/publication.ts';
import { writeReleaseAs } from './lib/release-please.ts';
import { PUBLISHED_FILE, readPublished, recordPending, writePublished } from './lib/trusted-publishing.ts';

const HELP = `Usage: prepare-publication [package]

Makes a private package public: removes "private" and " -- Private until verified" from its package.json,
sets its release-as to 1.0.0, and adds it to ${PUBLISHED_FILE} as waiting for publication.

Arguments:
  package     package name, such as @streetsidesoftware/unindent; default: the package in the current folder

Options:
  -h, --help  Show this help message.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const name = positionals[0] ?? (await currentPackageName());
  if (!name) throw new Error('Give a package name, or run this in a packages/* folder.');

  const found = (await findPackages()).find((p) => p.packageJson.name === name);
  if (!found) throw new Error(`Not a packages/* package in this repo: ${name}`);
  if (!found.packageJson.private) throw new Error(`${name} is already public.`);
  const published = await readPublished();
  if (published[name] === false) throw new Error(`${PUBLISHED_FILE} marks ${name} as never to be published.`);

  const pkgFile = Path.join(REPO_ROOT_DIR, found.dir, 'package.json');
  await fs.writeFile(pkgFile, stringifyPackageJson(makePublic(found.packageJson)), 'utf8');
  console.log(`${name}: removed private and "${PRIVATE_SUFFIX.trim()}" (${found.dir}/package.json)`);

  // A private package stays 0.x: Release Please only reaches 1.0.0 through a release-as set by hand.
  await writeReleaseAs([name], '1.0.0');

  await writePublished(recordPending(published, name));
  console.log(`${name}: waiting for publication in ${PUBLISHED_FILE}`);
}

await main();
