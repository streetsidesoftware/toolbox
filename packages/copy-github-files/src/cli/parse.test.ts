// cspell:ignore outptu
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import type { CommandLine } from './parse.ts';
import { parseCommandLine } from './parse.ts';

describe('parseCommandLine', () => {
  test('reads the repository, the paths and every option', () => {
    const args = ['owner/repo', 'a.md', 'b.md', '--output', 'docs', '--ref', 'v2', '--concurrency', '2'];

    const more = ['--exclude', 'banner.png', '--exclude', '!logo.png', '--fail-fast', '--silent'];

    assert.deepEqual(parseCommandLine([...args, ...more]), {
      repo: 'owner/repo',
      paths: ['a.md', 'b.md'],
      output: 'docs',
      ref: 'v2',
      exclude: ['banner.png', '!logo.png'],
      concurrency: 2,
      failFast: true,
      silent: true,
      help: false,
    });
  });

  test('gives the defaults for the options left out', () => {
    assert.deepEqual(parseCommandLine(['owner/repo', 'a.md']), {
      repo: 'owner/repo',
      paths: ['a.md'],
      output: '.',
      ref: undefined,
      exclude: [],
      concurrency: undefined,
      failFast: false,
      silent: false,
      help: false,
    });
  });

  testEach`
    option             | rawName
    ${'--outptu'}      | ${'--outptu'}
    ${'--outptu=docs'} | ${'--outptu'}
    ${'-o'}            | ${'-o'}
  `('names the unknown option in $option', ({ option, rawName }: { option: string; rawName: string }) => {
    assert.equal(
      parseCommandLine(['owner/repo', 'a.md', option]),
      `Unknown option ${rawName}. The options are --output, --ref, --exclude, --concurrency, --fail-fast, --silent and --help.`,
    );
  });

  testEach`
    args
    ${['--ref']}
    ${['--ref', '--output', 'docs']}
  `('names the option without its value in $args', ({ args }: { args: string[] }) => {
    assert.equal(
      parseCommandLine(['owner/repo', 'a.md', ...args]),
      'The --ref option must name a branch, tag or commit.',
    );
  });

  test('accepts a value that starts with a dash when written with =', () => {
    const commandLine = parseCommandLine(['owner/repo', 'a.md', '--ref=-v1']) as CommandLine;

    assert.equal(commandLine.ref, '-v1');
  });

  testEach`
    option
    ${'--help=yes'}
    ${'--silent=yes'}
    ${'--fail-fast=yes'}
  `('refuses a value for $option', ({ option }: { option: string }) => {
    const rawName = option.slice(0, option.indexOf('='));

    assert.equal(parseCommandLine(['owner/repo', 'a.md', option]), `The ${rawName} option takes no value.`);
  });

  testEach`
    option        | message
    ${'--output='} | ${'The --output option must name a folder.'}
    ${'--ref='}    | ${'The --ref option must name a branch, tag or commit.'}
    ${'--exclude='} | ${'The --exclude option must name a file or folder, such as banner.png.'}
  `('refuses an empty $option', ({ option, message }: { option: string; message: string }) => {
    assert.equal(parseCommandLine(['owner/repo', 'a.md', option]), message);
  });

  testEach`
    value
    ${'0'}
    ${'-1'}
    ${'1.5'}
    ${'many'}
    ${''}
    ${'08'}
  `('refuses --concurrency=$value', ({ value }: { value: string }) => {
    assert.equal(
      parseCommandLine(['owner/repo', 'a.md', `--concurrency=${value}`]),
      'The --concurrency option must be a whole number of at least 1.',
    );
  });
});
