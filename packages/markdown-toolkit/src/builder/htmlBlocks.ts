import {
  htmlBlockSlotNode,
  htmlGroupNode,
  htmlInlineSlotNode,
  htmlNode,
  inLists,
  paragraphNode,
  trimBlanks,
} from '../core/index.ts';
import type { HtmlGroupNode, HtmlSlotNode, RootContent } from '../core/index.ts';
import {
  argumentNodes,
  assertCondition,
  assertIsArray,
  blockNodes,
  groupedNodes,
  inlineNodes,
  isArray,
  mapParagraphsAndBlocks,
  MarkdownElement,
} from '../element/index.ts';
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
    htmlGroupNode([htmlNode('<details>'), inlineSlot('summary', summary, 'details summary')]),
    ...argumentNodes(content, 'details content'),
    htmlNode('</details>'),
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
    assertCondition(isArray(entry) && entry.length === 2, 'definition list entry must be a [term, definition] pair');
    const [term, definition] = entry;
    return [
      htmlGroupNode([inlineSlot('dt', term, 'definition term'), htmlNode('<dd>')]),
      ...groupedNodes([definition], 'definition'),
      htmlNode('</dd>'),
    ];
  });
  return new MarkdownElement('block', 'definitionList', 'a definition list', [
    htmlNode('<dl>'),
    ...nodes,
    htmlNode('</dl>'),
  ]);
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
  const parts: HtmlGroupNode['children'] = [htmlNode('<table>')];

  function addRow(tag: 'th' | 'td', cells: readonly AnyContent[]): void {
    parts.push(htmlNode('<tr>'));
    for (let i = 0; i < columns; ++i) {
      // GitHub keeps the `align` attribute and strips `style`.
      const open = align[i] ? `<${tag} align="${align[i]}">` : `<${tag}>`;
      parts.push(htmlBlockSlotNode(open, `</${tag}>`, cellNodes(cells[i] ?? [])));
    }
    parts.push(htmlNode('</tr>'));
  }

  if (header.length) {
    parts.push(htmlNode('<thead>'));
    addRow('th', header);
    parts.push(htmlNode('</thead>'));
  }
  parts.push(htmlNode('<tbody>'));
  rows.forEach((row) => addRow('td', row));
  parts.push(htmlNode('</tbody>'), htmlNode('</table>'));
  return new MarkdownElement('block', 'htmlTable', 'an HTML table', [htmlGroupNode(parts)]);
}

/** Return a slot for inline content between a tag's start and end. */
function inlineSlot(tag: string, content: InlineContent, where: string): HtmlSlotNode {
  return htmlInlineSlotNode(`<${tag}>`, `</${tag}>`, trimBlanks(inlineNodes(content, where)));
}

/** Return the blocks of a table cell, grouped as in a document. */
function cellNodes(content: AnyContent): RootContent[] {
  const nodes = mapParagraphsAndBlocks(
    content,
    (inline): RootContent => paragraphNode(trimBlanks(inlineNodes(inline, 'table cell'))),
    (block) => blockNodes(block, 'table cell'),
  );
  return inLists(nodes);
}
