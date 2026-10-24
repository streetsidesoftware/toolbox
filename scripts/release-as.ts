#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { currentPackageName } from './lib/packages.ts';
import { CONFIG_FILE, writeReleaseAs } from './lib/release-please.ts';

const HELP = `Usage: release-as [options] [packages...]

Sets the version Release Please releases next for packages in ${CONFIG_FILE}, or removes it.
update-release-please-config drops it once that version is released.

Arguments:
  packages             package names, such as @streetsidesoftware/unindent;
                       default: the package in the current folder

Options:
  --version <version>  the version to release, such as 1.0.0 or 3.2.0-alpha.0
  --remove             remove release-as instead of setting it
  -h, --help           Show this help message.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      version: { type: 'string' },
      remove: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  if (!values.remove && !values.version) throw new Error('Give --version <version>, or --remove.');

  let names = positionals;
  if (!names.length) {
    const current = await currentPackageName();
    if (!current) throw new Error('Give package names, or run this in a packages/* folder.');
    names = [current];
  }
  await writeReleaseAs(names, values.remove ? undefined : values.version);
}

await main();
