import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatTitle, parseTable } from './each.ts';
import { describeEach, testEach } from './index.ts';

const table = (strings: TemplateStringsArray, ...values: unknown[]) => parseTable('table', strings, values);

describe('parseTable header', () => {
  test('names the columns from the first line', () => {
    assert.deepEqual(table`a | b\n${1} | ${2}`, [{ a: 1, b: 2 }]);
  });

  test('ignores the whitespace around the header and its columns', () => {
    const rows = table`
        first   |   second
        ${1}    |   ${2}
    `;
    assert.deepEqual(rows, [{ first: 1, second: 2 }]);
  });

  test('allows a single column', () => {
    assert.deepEqual(table`a\n${1}\n${2}`, [{ a: 1 }, { a: 2 }]);
  });

  test('returns no rows for a header without values', () => {
    assert.deepEqual(table`a | b`, []);
  });

  test('keeps values as they are', () => {
    const obj = { x: 1 };
    const [row] = table`a | b | c\n${obj} | ${undefined} | ${'s'}`;
    assert.equal(row?.['a'], obj);
    assert.ok(row && Object.hasOwn(row, 'b'));
    assert.equal(row?.['c'], 's');
  });

  test('rejects an empty header', () => {
    assert.throws(
      () => table`
      ${1}
    `,
      /table: the first line must name the columns, separated by "\|", got ""/,
    );
  });

  test('rejects an empty column name', () => {
    assert.throws(() => table`a || b\n${1} | ${2} | ${3}`, /the first line must name the columns.*got "a \|\| b"/);
    assert.throws(() => table`a | b |\n${1} | ${2}`, /the first line must name the columns/);
  });

  test('rejects a column named twice', () => {
    assert.throws(() => table`a | a\n${1} | ${2}`, /table: the column "a" is named twice/);
  });
});

describe('parseTable rows', () => {
  test('reads several rows', () => {
    const rows = table`
      a    | b
      ${1} | ${2}
      ${3} | ${4}
    `;
    assert.deepEqual(rows, [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });

  test('rejects values that do not fill the last row', () => {
    assert.throws(() => table`a | b\n${1} | ${2}\n${3}`, /table: 3 values don't fill rows of 2 columns \(a, b\)/);
  });

  test('rejects a missing separator between values', () => {
    assert.throws(() => table`a | b\n${1} ${2}`, /table: expected "\|" after a value in row 1, got ""/);
  });

  test('rejects a separator after the last value of a row', () => {
    assert.throws(() => table`a | b\n${1} | ${2} |\n${3} | ${4}`, /expected "" after a value in row 1, got "\|"/);
  });

  test('rejects text between values', () => {
    assert.throws(() => table`a | b\n${1} | ${2}\n${3} x | ${4}`, /expected "\|" after a value in row 2, got "x \|"/);
  });
});

describe('formatTitle', () => {
  test('replaces each $column with its value', () => {
    assert.equal(formatTitle('$a + $b', { a: 1, b: 2 }), '1 + 2');
  });

  test('formats values with util.inspect', () => {
    assert.equal(
      formatTitle('$s $n $o $u', { s: 'x', n: null, o: { k: [1] }, u: undefined }),
      "'x' null { k: [ 1 ] } undefined",
    );
  });

  test('leaves $names that are not columns', () => {
    assert.equal(formatTitle('$a $other $constructor $', { a: 1 }), '1 $other $constructor $');
  });
});

describe('testEach', () => {
  const seen: unknown[] = [];

  testEach`
    a    | b    | sum
    ${1} | ${2} | ${3}
    ${2} | ${3} | ${5}
  `('$a + $b', ({ a, b, sum }: { a: number; b: number; sum: number }, t) => {
    assert.equal(a + b, sum);
    seen.push(t.name);
  });

  test('ran one test per row with the formatted title', () => {
    assert.deepEqual(seen, ['1 + 2', '2 + 3']);
  });

  test('throws when the table is tagged, before any test is registered', () => {
    assert.throws(() => testEach`a | b\n${1}`, /^Error: testEach: 1 values don't fill rows/);
  });
});

describe('describeEach', () => {
  const seen: unknown[] = [];

  describeEach`
    name     | input
    ${'one'} | ${1}
    ${'two'} | ${2}
  `('$name', ({ input }: { name: string; input: number }, s) => {
    test('runs inside the suite', () => {
      seen.push([s.name, input]);
    });
  });

  test('ran one suite per row with the formatted title', () => {
    assert.deepEqual(seen, [
      ["'one'", 1],
      ["'two'", 2],
    ]);
  });

  test('throws when the table is tagged', () => {
    assert.throws(() => describeEach`a || b`, /^Error: describeEach: the first line must name the columns/);
  });
});
