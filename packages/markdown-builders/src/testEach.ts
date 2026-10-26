import { test } from 'node:test';
import { inspect } from 'node:util';

/**
 * Runs one `test` per row of a table written as a tagged template, like vitest's `test.each`.
 * The first line names the columns, separated by `|`. Each row after it holds one `${value}` per column.
 * A `$column` in the title is replaced by that row's value.
 *
 * @example
 * testEach`
 *     a    | b    | sum
 *     ${1} | ${2} | ${3}
 * `('$a + $b', ({ a, b, sum }: { a: number; b: number; sum: number }) => {
 *     assert.equal(a + b, sum);
 * });
 */
export function testEach(
  strings: TemplateStringsArray,
  ...values: unknown[]
): <Row>(title: string, fn: (row: Row) => void | Promise<void>) => void {
  const columns = parseColumns(strings);
  const rows = toRows(strings, values, columns);
  return (title, fn) => {
    for (const row of rows) {
      test(formatTitle(title, row), () => fn(row as never));
    }
  };
}

function parseColumns(strings: TemplateStringsArray): string[] {
  const header = strings[0]?.trim() ?? '';
  const columns = header.split('|').map((column) => column.trim());
  if (!header || columns.some((column) => !column)) {
    throw new Error(`testEach: the first line must name the columns, separated by "|", got "${header}"`);
  }
  return columns;
}

function toRows(strings: TemplateStringsArray, values: unknown[], columns: string[]): Record<string, unknown>[] {
  if (values.length % columns.length) {
    throw new Error(
      `testEach: ${values.length} values don't fill rows of ${columns.length} columns (${columns.join(', ')})`,
    );
  }
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; start < values.length; start += columns.length) {
    const row: Record<string, unknown> = {};
    for (const [i, column] of columns.entries()) {
      const separator = strings[start + i + 1]?.trim();
      const expected = i < columns.length - 1 ? '|' : '';
      if (separator !== expected) {
        throw new Error(`testEach: expected "${expected}" after a value in row ${rows.length + 1}`);
      }
      row[column] = values[start + i];
    }
    rows.push(row);
  }
  return rows;
}

function formatTitle(title: string, row: Record<string, unknown>): string {
  return title.replace(/\$(\w+)/g, (match, column: string) => (column in row ? inspect(row[column]) : match));
}
