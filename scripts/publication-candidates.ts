#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { findPackages } from './lib/packages.ts';
import { publicationCandidates } from './lib/publication.ts';
import { PUBLISHED_FILE, readPublished } from './lib/trusted-publishing.ts';

const HELP = `Usage: publication-candidates [package]

Prints, as a JSON array of {"dir", "name"}, the private packages/* packages waiting for publication: every one that
${PUBLISHED_FILE} doesn't mark false. The Prepare a New Package for Publication workflow runs this.

Arguments:
  package     only this package: its directory under packages/, such as unindent, or its name

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

  const packages = await findPackages();
  const published = await readPublished();
  let candidates = publicationCandidates(packages, published);

  const select = positionals[0];
  if (select) {
    const found = packages.find((p) => p.dir === `packages/${select}` || p.packageJson.name === select);
    if (!found) throw new Error(`Not a packages/* package in this repo: ${select}`);
    candidates = candidates.filter((c) => c.name === found.packageJson.name);
    if (!candidates.length) {
      const reason = found.packageJson.private ? `${PUBLISHED_FILE} marks it never to be published` : 'it is public';
      console.error(`Skipping ${select}: ${reason}.`);
    }
  }

  console.log(JSON.stringify(candidates));
}

await main();
