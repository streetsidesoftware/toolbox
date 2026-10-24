#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import Path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR, REPOSITORY } from './lib/consts.ts';
import { currentPackageName, findPackages } from './lib/packages.ts';
import { formatJson, readJsonFile } from './lib/release-please.ts';
import type { Published, TrustConfig } from './lib/trusted-publishing.ts';
import {
  hasPublisher,
  parseJsonValues,
  PUBLISHED_FILE,
  recordTrusted,
  WORKFLOW_FILE,
} from './lib/trusted-publishing.ts';

const HELP = `Usage: trusted-publishing [options] [packages...]

Adds a trusted publisher for ${WORKFLOW_FILE} to each public package that doesn't have one, and records it in
${PUBLISHED_FILE}. Needs npm 11.15 or later, and \`npm login --auth-type=web\` with publish rights for the package.
npm asks for 2FA in the browser: choose to skip 2FA for the next 5 minutes, and rerun when the window ends.

Arguments:
  packages    package names; default: the package in the current folder

Options:
  --all       every public packages/* package
  --check     report each package's trusted publisher and how its latest version was published
  --mfa       require 2FA and disallow tokens for publishing each package
  --dry-run   show what would change without changing it
  -h, --help  Show this help message.
`;

const REGISTRY = 'https://registry.npmjs.org';
// npm recommends a pause between trust calls to avoid rate limiting.
const PAUSE_MS = 1000;

interface PublishInfo {
  version: string;
  publisher: string;
  oidc: boolean;
}

async function fetchLatest(name: string): Promise<PublishInfo | undefined> {
  const response = await fetch(`${REGISTRY}/${name.replaceAll('/', '%2f')}/latest`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${name}: registry returned ${response.status}`);
  const manifest = (await response.json()) as {
    version: string;
    _npmUser?: { name?: string; trustedPublisher?: unknown };
  };
  return {
    version: manifest.version,
    publisher: manifest._npmUser?.name ?? 'unknown',
    oidc: Boolean(manifest._npmUser?.trustedPublisher),
  };
}

function npm(args: string[]): number {
  console.error('Running npm %s', args.join(' '));
  const result = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status ?? 1;
}

// npm only prompts for 2FA when stdout is a terminal, so a captured call that needs 2FA is repeated in the terminal
// first. That starts the 5-minute window, and the captured call is retried.
function npmJson(args: string[]): unknown[] {
  for (let attempt = 0; ; ++attempt) {
    const result = spawnSync('npm', [...args, '--json'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    const values = parseJsonValues(result.stdout);
    const error = values.find((v): v is { error: { code?: string } } => isObject(v) && isObject(v.error));
    if (!error && result.status === 0) return values;
    if (error?.error.code === 'EOTP' && attempt === 0) {
      npm(args);
      continue;
    }
    throw new Error(`npm ${args.join(' ')} failed:\n${result.stderr}${result.stdout}`);
  }
}

function listTrust(name: string): TrustConfig[] {
  return npmJson(['trust', 'list', name]) as TrustConfig[];
}

async function readPublished(): Promise<Published> {
  return (await readJsonFile<Published>(PUBLISHED_FILE)) ?? {};
}

async function writePublished(published: Published): Promise<void> {
  const file = Path.join(REPO_ROOT_DIR, PUBLISHED_FILE);
  await fs.mkdir(Path.dirname(file), { recursive: true });
  await fs.writeFile(file, formatJson(published), 'utf8');
}

async function addTrust(names: string[], dryRun: boolean): Promise<void> {
  let published = await readPublished();
  for (const name of names) {
    if (published[name]?.trustedPublishing) {
      console.log(`${name}: recorded as trusting ${WORKFLOW_FILE}`);
      continue;
    }
    if (!(await fetchLatest(name))) {
      console.log(`${name}: not on npm yet. Publish its first version by hand, then run this again.`);
      continue;
    }
    const configs = listTrust(name);
    await sleep(PAUSE_MS);
    if (!hasPublisher(configs, REPOSITORY)) {
      const args = ['trust', 'github', name, '--file', WORKFLOW_FILE, '--repo', REPOSITORY];
      args.push('--allow-publish', '--allow-stage-publish', '--yes');
      if (dryRun) args.push('--dry-run');
      if (npm(args) !== 0) throw new Error(`${name}: npm trust github failed`);
      await sleep(PAUSE_MS);
    } else {
      console.log(`${name}: already trusts ${WORKFLOW_FILE}`);
    }
    if (!dryRun) {
      published = recordTrusted(published, name, true);
      await writePublished(published);
    }
  }
}

async function check(names: string[]): Promise<void> {
  let published = await readPublished();
  let problems = 0;
  for (const name of names) {
    const latest = await fetchLatest(name);
    if (!latest) {
      console.log(`${name}: not on npm yet`);
      ++problems;
      continue;
    }
    const trusted = hasPublisher(listTrust(name), REPOSITORY);
    published = recordTrusted(published, name, trusted);
    await writePublished(published);
    const how = latest.oidc ? 'OIDC' : `token (${latest.publisher})`;
    console.log(`${name}: trusted publisher ${trusted ? 'yes' : 'no'}; ${latest.version} published with ${how}`);
    if (!trusted || !latest.oidc) ++problems;
    await sleep(PAUSE_MS);
  }
  console.log(`${names.length - problems} of ${names.length} packages publish through OIDC.`);
  if (problems) process.exitCode = 1;
}

async function requireMfa(names: string[], dryRun: boolean): Promise<void> {
  for (const name of names) {
    const args = ['access', 'set', 'mfa=publish', name];
    // `npm access` ignores --dry-run.
    if (dryRun) {
      console.log(`Would run: npm ${args.join(' ')}`);
      continue;
    }
    if (npm(args) !== 0) throw new Error(`${name}: npm access set mfa=publish failed`);
    await sleep(PAUSE_MS);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: 'boolean' },
      check: { type: 'boolean' },
      mfa: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  if (values.check && values.mfa) throw new Error('Use either --check or --mfa, not both.');
  if (values.all && positionals.length) throw new Error('Use either --all or package names, not both.');

  const publicPackages = (await findPackages())
    .filter((p) => !p.packageJson.private)
    .map((p) => p.packageJson.name)
    .filter((name): name is string => !!name);

  let requested = positionals;
  if (!values.all && !requested.length) {
    const current = await currentPackageName();
    if (!current) throw new Error('Give package names or --all, or run this in a packages/* folder.');
    requested = [current];
  }
  const notPublic = requested.filter((name) => !publicPackages.includes(name));
  if (notPublic.length) throw new Error(`Not a public package in this repo: ${notPublic.join(', ')}`);
  const names = values.all ? publicPackages : requested;

  const dryRun = !!values['dry-run'];
  if (values.check) return check(names);
  if (values.mfa) return requireMfa(names, dryRun);
  return addTrust(names, dryRun);
}

await main();
// cspell:ignore EOTP
