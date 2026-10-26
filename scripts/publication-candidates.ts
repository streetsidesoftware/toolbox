#!/usr/bin/env node

import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { REPOSITORY } from './lib/consts.ts';
import { findPackages } from './lib/packages.ts';
import type { PublicationCandidate } from './lib/publication.ts';
import { publicationBranch, publicationCandidates, withoutOpenPrs } from './lib/publication.ts';
import type { ReleasePleaseConfig } from './lib/release-please.ts';
import { CONFIG_FILE, readJsonFile } from './lib/release-please.ts';
import { PUBLISHED_FILE, readPublished } from './lib/trusted-publishing.ts';

const HELP = `Usage: publication-candidates [options] [package]

Prints, as a JSON array of {"dir", "name"}, the private packages/* packages to open a publication PR for: every one
that's in ${CONFIG_FILE}, that ${PUBLISHED_FILE} doesn't mark false, and whose PR isn't open. Sends GITHUB_TOKEN to the GitHub API if set.
The Prepare a New Package for Publication workflow runs this.

Arguments:
  package          only this package: its directory under packages/, such as unindent, or its name;
                   blank: every package

Options:
  --github-output  also write the array to $GITHUB_OUTPUT as "packages"
  -h, --help       Show this help message.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'github-output': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const packages = await findPackages();
  const config = await readJsonFile<ReleasePleaseConfig>(CONFIG_FILE);
  if (!config) throw new Error(`${CONFIG_FILE} not found`);
  const components = Object.values(config.packages).map((e) => e.component);
  const published = await readPublished();
  let candidates = publicationCandidates(packages, published, components);

  const select = positionals[0];
  if (select) {
    const found = packages.find((p) => p.dir === `packages/${select}` || p.packageJson.name === select);
    if (!found) throw new Error(`Not a packages/* package in this repo: ${select}`);
    candidates = candidates.filter((c) => c.name === found.packageJson.name);
    if (!candidates.length) {
      const name = found.packageJson.name ?? '';
      const reason = !found.packageJson.private
        ? 'it is public'
        : published[name] === false
          ? `${PUBLISHED_FILE} marks it never to be published`
          : `it isn't in ${CONFIG_FILE} yet`;
      console.error(`Skipping ${select}: ${reason}.`);
    }
  }

  const ready = withoutOpenPrs(candidates, await openPrBranches(candidates));
  logSkipped(candidates, ready);

  const json = JSON.stringify(ready);
  console.log(json);
  if (values['github-output']) {
    const file = process.env.GITHUB_OUTPUT;
    if (!file) throw new Error('--github-output: GITHUB_OUTPUT is not set.');
    await fs.appendFile(file, `packages=${json}\n`, 'utf8');
  }
}

/** The publication branches of `candidates` that have an open PR. */
async function openPrBranches(candidates: PublicationCandidate[]): Promise<string[]> {
  const [owner] = REPOSITORY.split('/');
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const open: string[] = [];
  for (const { dir } of candidates) {
    const branch = publicationBranch(dir);
    const url = `https://api.github.com/repos/${REPOSITORY}/pulls?state=open&head=${owner}:${branch}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status} for ${url}`);
    if (((await response.json()) as unknown[]).length) open.push(branch);
  }
  return open;
}

function logSkipped(candidates: PublicationCandidate[], ready: PublicationCandidate[]): void {
  for (const c of candidates) {
    if (!ready.includes(c)) console.error(`Skipping ${c.name}: ${publicationBranch(c.dir)} has an open PR.`);
  }
}

await main();
