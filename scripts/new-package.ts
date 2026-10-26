#!/usr/bin/env node

import Path from 'node:path';
import { parseArgs } from 'node:util';

import { REPO_ROOT_DIR } from './lib/consts.ts';
import { createPackage, PRIVATE_SUFFIX, SCOPE } from './lib/new-package.ts';

const HELP = `Usage: new-package [options] <name>

Creates packages/<name>/, a private ${SCOPE}/<name> package at 0.0.1-alpha.0,
with a placeholder source file, test and README.

Arguments:
  name                     the package folder and name without the scope, such as test-each

Options:
  --description <text>     the package description; "${PRIVATE_SUFFIX.trim()}" is appended
  -h, --help               Show this help message.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      description: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const [name] = positionals;
  if (!name || positionals.length > 1) throw new Error('Give one package name. See --help.');

  const dir = await createPackage(name, { description: values.description });
  console.log(`Created ${Path.relative(REPO_ROOT_DIR, dir)}. Next: pnpm install, then fill in the README and src/.`);
}

await main();
