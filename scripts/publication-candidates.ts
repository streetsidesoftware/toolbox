#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { REPOSITORY } from './lib/consts.ts';
import { findPackages } from './lib/packages.ts';
import type { PublicationCandidate } from './lib/publication.ts';
import { publicationBranch, publicationCandidates, withoutOpenPrs } from './lib/publication.ts';
import { PUBLISHED_FILE, readPublished } from './lib/trusted-publishing.ts';

const HELP = `Usage: publication-candidates [options] [package]

Prints, as a JSON array of {"dir", "name"}, the private packages/* packages to open a publication PR for: every one
that ${PUBLISHED_FILE} doesn't mark false and whose PR isn't open. Needs the GitHub CLI (gh), logged in.
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
  let candidates = publicationCandidates(packages, await readPublished());

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

  const ready = withoutOpenPrs(candidates, candidates.length ? openPrBranches() : []);
  logSkipped(candidates, ready);

  const json = JSON.stringify(ready);
  console.log(json);
  if (values['github-output']) {
    const file = process.env.GITHUB_OUTPUT;
    if (!file) throw new Error('--github-output: GITHUB_OUTPUT is not set.');
    await fs.appendFile(file, `packages=${json}\n`, 'utf8');
  }
}

function openPrBranches(): string[] {
  const args = ['pr', 'list', '--repo', REPOSITORY, '--state', 'open', '--limit', '500', '--json', 'headRefName'];
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed:\n${result.stderr}`);
  return (JSON.parse(result.stdout) as { headRefName: string }[]).map((pr) => pr.headRefName);
}

function logSkipped(candidates: PublicationCandidate[], ready: PublicationCandidate[]): void {
  for (const c of candidates) {
    if (!ready.includes(c)) console.error(`Skipping ${c.name}: ${publicationBranch(c.dir)} has an open PR.`);
  }
}

await main();
