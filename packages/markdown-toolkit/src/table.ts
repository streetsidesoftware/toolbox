import type { AlignType, TableRow } from 'mdast';

import { describe, inlineNodes, isArray, MarkdownElement } from './nodes.ts';
import type { ColumnAlign, InlineContent, MDTable, TableOptions } from './types.ts';

/**
 * A GFM table: a header row, then one row per entry. Each cell is inline content.
 * - A `|` in a cell is escaped, and a line break renders as `<br/>`.
 * - A short row is padded with empty cells.
 * - `align` aligns each column: `'left'`, `'center'`, `'right'`, a delimiter such as `:-:`, or `undefined` for none.
 */
export function table(
  header: readonly InlineContent[],
  rows: readonly (readonly InlineContent[])[],
  options?: TableOptions,
): MDTable {
  if (!isArray(header)) throw new TypeError(`table header must be an array, got ${describe(header)}`);
  if (!isArray(rows)) throw new TypeError(`table rows must be an array, got ${describe(rows)}`);
  return new MarkdownElement('block', 'a table', [
    {
      type: 'table',
      align: (options?.align ?? []).map(alignOf),
      children: [header, ...rows].map(rowNode),
    },
  ]);
}

function rowNode(cells: readonly InlineContent[]): TableRow {
  if (!isArray(cells)) throw new TypeError(`table row must be an array, got ${describe(cells)}`);
  return {
    type: 'tableRow',
    children: cells.map((cell) => ({ type: 'tableCell', children: inlineNodes(cell, 'table cell') })),
  };
}

/** The alignment of a column, or `null` for none. */
export function alignOf(align: ColumnAlign): AlignType {
  if (align === undefined || align === 'left' || align === 'center' || align === 'right') return align ?? null;
  const delimiter = /^(:?)-+(:?)$/.exec(align);
  if (!delimiter) throw new Error(`invalid column alignment: "${String(align)}"`);
  const [, left, right] = delimiter;
  return left && right ? 'center' : left ? 'left' : right ? 'right' : null;
}
