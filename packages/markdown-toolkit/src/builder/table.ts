import { tableNode } from '../core/index.ts';
import type { AlignType, PhrasingContent } from '../core/index.ts';
import { assertCondition, assertIsArray, inlineNodes, MarkdownElement } from '../element/index.ts';
import type { ColumnAlign, InlineContent, MDTable, TableOptions } from '../types.ts';

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
  assertIsArray(header, 'table header');
  assertIsArray(rows, 'table rows');
  return new MarkdownElement('block', 'table', 'a table', [
    tableNode((options?.align ?? []).map(alignOf), [header, ...rows].map(rowCells)),
  ]);
}

function rowCells(cells: readonly InlineContent[]): PhrasingContent[][] {
  assertIsArray(cells, 'table row');
  return cells.map((cell) => inlineNodes(cell, 'table cell'));
}

/** Return the alignment of a column, or `null` for none. */
export function alignOf(align: ColumnAlign): AlignType {
  if (align === undefined || align === 'left' || align === 'center' || align === 'right') return align ?? null;
  const delimiter = /^(:?)-+(:?)$/.exec(align);
  assertCondition(delimiter, "column alignment must be 'left', 'center', 'right' or a delimiter such as ':---'");
  const [, left, right] = delimiter;
  return left && right ? 'center' : left ? 'left' : right ? 'right' : null;
}
