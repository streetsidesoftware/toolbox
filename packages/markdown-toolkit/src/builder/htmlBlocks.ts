import type { Html, RootContent } from 'mdast';

import {
  argumentNodes,
  assertCondition,
  assertIsArray,
  blockNodes,
  describe,
  groupedNodes,
  inlineNodes,
  inLists,
  isArray,
  mapParagraphsAndBlocks,
  MarkdownElement,
} from '../element/index.ts';
import { trimBlanks } from '../mdast/index.ts';
import type { HtmlGroupNode, HtmlSlotNode } from '../mdast/index.ts';
import type {
  AnyContent,
  DefinitionEntry,
  InlineContent,
  MDDefinitionList,
  MDDetails,
  MDHtmlTable,
  TableOptions,
} from '../types.ts';
import { alignOf } from './table.ts';

/**
 * Create a collapsible section: the reader sees `summary` and clicks it to show the content.
 *
 * The content can hold anything a page can, such as paragraphs, lists and tables. Each piece of it goes on a line of
 * its own:
 * - Text, links and other pieces in a row form one paragraph. The page shows a space between them.
 * - A piece that shows nothing ends the paragraph.
 * - A paragraph, list or other block goes on its own lines.
 * - An array is one piece, and its parts join with no spaces added. For a sentence built from pieces, use an array or
 *   {@link p}.
 *
 * @example
 * md.details('Show more', 'Hidden text.');
 * // The page shows "Show more"; clicking it reveals "Hidden text."
 * @category sections
 */
export function details(summary: InlineContent, ...content: AnyContent[]): MDDetails {
  return new MarkdownElement('block', 'details', 'a details block', [
    { type: 'htmlGroup', children: [html('<details>'), inlineSlot('summary', summary, 'details summary')] },
    ...argumentNodes(content, 'details content'),
    html('</details>'),
  ]);
}

/**
 * Create a list of terms, each followed by its definition.
 *
 * Give one `[term, definition]` pair per entry. A definition can hold anything, including lists and paragraphs.
 *
 * @example
 * md.dl([['words', 'Words to accept as correct.']]);
 * // The page shows "words", with "Words to accept as correct." below it.
 * @category lists
 */
export function dl(entries: readonly DefinitionEntry[]): MDDefinitionList {
  assertIsArray(entries, 'definition list entries');
  const nodes = entries.flatMap((entry): RootContent[] => {
    assertCondition(
      isArray(entry) && entry.length === 2,
      `definition list entry must be a [term, definition] pair, got ${describe(entry)}`,
    );
    const [term, definition] = entry;
    return [
      { type: 'htmlGroup', children: [inlineSlot('dt', term, 'definition term'), html('<dd>')] },
      ...groupedNodes([definition], 'definition'),
      html('</dd>'),
    ];
  });
  return new MarkdownElement('block', 'definitionList', 'a definition list', [html('<dl>'), ...nodes, html('</dl>')]);
}

/** The same as {@link dl}. */
export const definitionList: typeof dl = dl;

/**
 * Create a table whose cells can hold anything, including lists and paragraphs.
 *
 * With an empty header, the table has no header row.
 *
 * @param options - `align` sets each column's alignment: `'left'`, `'center'` or `'right'`.
 * @example
 * md.htmlTable(['Language', 'Dialects'], [['Dutch', md.list(['Flemish', 'Limburgish'])]]);
 * // The page shows a table with a bulleted list in the Dialects cell.
 * @category tables
 */
export function htmlTable(
  header: readonly AnyContent[],
  rows: readonly (readonly AnyContent[])[],
  options?: TableOptions,
): MDHtmlTable {
  assertIsArray(header, 'table header');
  assertIsArray(rows, 'table rows');
  for (const row of rows) {
    assertIsArray(row, 'table row');
  }
  const columns = rows.reduce((n, row) => Math.max(n, row.length), header.length);
  const align = (options?.align ?? []).map(alignOf);
  const parts: HtmlGroupNode['children'] = [html('<table>')];

  function addRow(tag: 'th' | 'td', cells: readonly AnyContent[]): void {
    parts.push(html('<tr>'));
    for (let i = 0; i < columns; ++i) {
      parts.push({
        type: 'htmlBlockSlot',
        // GitHub keeps the `align` attribute and strips `style`.
        open: align[i] ? `<${tag} align="${align[i]}">` : `<${tag}>`,
        close: `</${tag}>`,
        children: cellNodes(cells[i] ?? []),
      });
    }
    parts.push(html('</tr>'));
  }

  if (header.length) {
    parts.push(html('<thead>'));
    addRow('th', header);
    parts.push(html('</thead>'));
  }
  parts.push(html('<tbody>'));
  rows.forEach((row) => addRow('td', row));
  parts.push(html('</tbody>'), html('</table>'));
  return new MarkdownElement('block', 'htmlTable', 'an HTML table', [{ type: 'htmlGroup', children: parts }]);
}

/** Return a slot for inline content between a tag's start and end. */
function inlineSlot(tag: string, content: InlineContent, where: string): HtmlSlotNode {
  return {
    type: 'htmlInlineSlot',
    open: `<${tag}>`,
    close: `</${tag}>`,
    children: [{ type: 'paragraph', children: trimBlanks(inlineNodes(content, where)) }],
  };
}

/** Return the blocks of a table cell, grouped as in a document. */
function cellNodes(content: AnyContent): RootContent[] {
  const nodes = mapParagraphsAndBlocks(
    content,
    (inline): RootContent => ({ type: 'paragraph', children: trimBlanks(inlineNodes(inline, 'table cell')) }),
    (block) => blockNodes(block, 'table cell'),
  );
  return inLists(nodes);
}

function html(value: string): Html {
  return { type: 'html', value };
}
