import type { AlignType, TableRow } from 'mdast';

import { describe, inlineNodes, isArray, MarkdownElement } from './nodes.ts';
import type { ColumnAlign, InlineContent, MDTable, TableOptions } from './types.ts';

/**
 * Create a table with a header row, then one row per entry.
 *
 * A cell holds text, links, formatting or code, but not lists or paragraphs. For those, use {@link htmlTable}.
 *
 * @param options - `align` sets each column's alignment: `'left'`, `'center'` or `'right'`.
 * @example
 * md.table(['Language', 'Code'], [['Dutch', 'nl'], ['French', 'fr']]);
 * // | Language | Code |
 * // | -------- | ---- |
 * // | Dutch    | nl   |
 * // | French   | fr   |
 * @category tables
 */
export function table(
  header: readonly InlineContent[],
  rows: readonly (readonly InlineContent[])[],
  options?: TableOptions,
): MDTable {
  if (!isArray(header)) throw new TypeError(`table header must be an array, got ${describe(header)}`);
  if (!isArray(rows)) throw new TypeError(`table rows must be an array, got ${describe(rows)}`);
  return new MarkdownElement('block', 'table', 'a table', [
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

/** Return the alignment of a column, or `null` for none. */
export function alignOf(align: ColumnAlign): AlignType {
  if (align === undefined || align === 'left' || align === 'center' || align === 'right') return align ?? null;
  const delimiter = /^(:?)-+(:?)$/.exec(align);
  if (!delimiter) throw new Error(`invalid column alignment: "${String(align)}"`);
  const [, left, right] = delimiter;
  return left && right ? 'center' : left ? 'left' : right ? 'right' : null;
}
