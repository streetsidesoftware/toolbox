import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { expandBraces } from './braces.ts';

describe('expandBraces', () => {
  testEach`
    pattern                              | expected
    ${'src/*/{*/*.ts,*.ts}'}             | ${['src/*/*/*.ts', 'src/*/*.ts']}
    ${'src/{cli/{run.ts,run.js},*.js}'}  | ${['src/cli/{run.ts,run.js}', 'src/*.js']}
    ${'src/{a,b/{c/d,e}}.ts'}            | ${['src/a.ts', 'src/b/c/d.ts', 'src/b/e.ts']}
    ${'{a/b,c}/{d/e,f}'}                 | ${['a/b/d/e', 'a/b/f', 'c/d/e', 'c/f']}
    ${'src/{,x/}*.ts'}                   | ${['src/*.ts', 'src/x/*.ts']}
    ${'src/{cli,tests}/{a/b,c}.{ts,js}'} | ${['src/{cli,tests}/a/b.{ts,js}', 'src/{cli,tests}/c.{ts,js}']}
    ${'src/{cli,tests}/*.{ts,js}'}       | ${['src/{cli,tests}/*.{ts,js}']}
    ${'src/{a/b}/*.ts'}                  | ${['src/{a/b}/*.ts']}
    ${'src/*/{*/*.ts'}                   | ${['src/*/{*/*.ts']}
    ${'src/*.ts'}                        | ${['src/*.ts']}
  `('expands $pattern into $expected', ({ pattern, expected }: { pattern: string; expected: string[] }) => {
    assert.deepEqual(expandBraces(pattern), expected);
  });
});
