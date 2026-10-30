import { describe, test } from 'node:test';
import type { SuiteContext, TestContext } from 'node:test';
import { inspect } from 'node:util';

/** Holds one row of a table, by column name. */
export type Row = Record<string, unknown>;

/** Registers one `node:test` test per row. */
export type EachTest = <R = Row>(title: string, fn: (row: R, t: TestContext) => void | Promise<void>) => void;

/** Registers one `node:test` suite per row. */
export type EachSuite = <R = Row>(title: string, fn: (row: R, s: SuiteContext) => void | Promise<void>) => void;

/**
 * Register one `test` per row of a table written as a tagged template, like vitest's `test.each`.
 *
 * - The first line names the columns, separated by `|`.
 * - Each line after it is one row, with one `${value}` per column.
 * - A `$column` in the title is replaced by that row's value.
 *
 * The test function gets the row and the test context. For one `describe` suite per row, use {@link describeEach}.
 *
 * @example
 * testEach`
 *     a    | b    | sum
 *     ${1} | ${2} | ${3}
 *     ${2} | ${3} | ${5}
 * `('$a + $b', ({ a, b, sum }: { a: number; b: number; sum: number }) => {
 *     assert.equal(a + b, sum);
 * });
 * // ✔ 1 + 2
 * // ✔ 2 + 3
 */
export function testEach(strings: TemplateStringsArray, ...values: unknown[]): EachTest {
  const rows = parseTable('testEach', strings, values);
  return (title, fn) => {
    for (const row of rows) {
      test(formatTitle(title, row), (t) => fn(row as never, t));
    }
  };
}

/**
 * Register one `describe` suite per row of a table written as a tagged template, like vitest's `describe.each`.
 *
 * - The first line names the columns, separated by `|`.
 * - Each line after it is one row, with one `${value}` per column.
 * - A `$column` in the title is replaced by that row's value.
 *
 * The suite function gets the row and the suite context. For one `test` per row, use {@link testEach}.
 *
 * @example
 * describeEach`
 *     name       | input
 *     ${'empty'} | ${''}
 *     ${'word'}  | ${'hello'}
 * `('$name', ({ input }: { name: string; input: string }) => {
 *     test('round-trips', () => {
 *         assert.equal(JSON.parse(JSON.stringify(input)), input);
 *     });
 * });
 * // Runs the suites 'empty' and 'word', each with a 'round-trips' test.
 */
export function describeEach(strings: TemplateStringsArray, ...values: unknown[]): EachSuite {
  const rows = parseTable('describeEach', strings, values);
  return (title, fn) => {
    for (const row of rows) {
      describe(formatTitle(title, row), (s) => fn(row as never, s));
    }
  };
}

export function parseTable(name: string, strings: readonly string[], values: readonly unknown[]): Row[] {
  const columns = parseColumns(name, strings);
  if (values.length % columns.length) {
    throw new Error(
      `${name}: ${values.length} values don't fill rows of ${columns.length} columns (${columns.join(', ')})`,
    );
  }
  const rows: Row[] = [];
  for (let start = 0; start < values.length; start += columns.length) {
    const row: Row = Object.create(null);
    for (const [i, column] of columns.entries()) {
      const separator = strings[start + i + 1]?.trim();
      const expected = i < columns.length - 1 ? '|' : '';
      if (separator !== expected) {
        throw new Error(`${name}: expected "${expected}" after a value in row ${rows.length + 1}, got "${separator}"`);
      }
      row[column] = values[start + i];
    }
    rows.push(row);
  }
  return rows;
}

function parseColumns(name: string, strings: readonly string[]): string[] {
  const header = strings[0]?.trim() ?? '';
  const columns = header.split('|').map((column) => column.trim());
  if (!header || columns.some((column) => !column)) {
    throw new Error(`${name}: the first line must name the columns, separated by "|", got "${header}"`);
  }
  const duplicate = columns.find((column, i) => columns.indexOf(column) !== i);
  if (duplicate) {
    throw new Error(`${name}: the column "${duplicate}" is named twice`);
  }
  return columns;
}

export function formatTitle(title: string, row: Row): string {
  return title.replace(/\$(\w+)((?:\.\w+)*)/g, (match, column: string, path: string) =>
    Object.hasOwn(row, column) ? inspect(followPath(row[column], path)) : match,
  );
}

// Follow a `.a.b` path into a value, like vitest's `$a.b`. A missing step gives `undefined`.
function followPath(value: unknown, path: string): unknown {
  for (const key of path.split('.').slice(1)) {
    value = value == null ? undefined : (value as Record<string, unknown>)[key];
  }
  return value;
}
