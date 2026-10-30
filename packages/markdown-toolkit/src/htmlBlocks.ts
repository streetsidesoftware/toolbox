import type { Html, PhrasingContent, RootContent } from 'mdast';

import {
  blockNodes,
  describe,
  groupedNodes,
  inlineNodes,
  isArray,
  isText,
  mapParagraphsAndBlocks,
  MarkdownElement,
} from './nodes.ts';
import { withoutEmptyNodes } from './render.ts';
import { alignOf } from './table.ts';
import type {
  AnyContent,
  DefinitionEntry,
  InlineContent,
  MDDefinitionList,
  MDDetails,
  MDHtmlTable,
  TableOptions,
} from './types.ts';

/**
 * Creates a collapsible section: the reader sees `summary` and clicks it to show the content.
 *
 * The content can hold anything a page can, such as paragraphs, lists and tables.
 *
 * @example
 * md.details('Show more', 'Hidden text.');
 * // The page shows "Show more"; clicking it reveals "Hidden text."
 * @category sections
 */
export function details(summary: InlineContent, ...content: AnyContent[]): MDDetails {
  return new MarkdownElement('block', 'details', 'a details block', [
    ...wrapped('<details>\n', 'summary', summary, '', 'details summary'),
    ...groupedNodes(content, 'details content'),
    html('</details>'),
  ]);
}

/**
 * Creates a list of terms, each followed by its definition.
 *
 * Give one `[term, definition]` pair per entry. A definition can hold anything, including lists and paragraphs.
 *
 * @example
 * md.dl([['words', 'Words to accept as correct.']]);
 * // The page shows "words", with "Words to accept as correct." below it.
 * @category lists
 */
export function dl(entries: readonly DefinitionEntry[]): MDDefinitionList {
  if (!Array.isArray(entries)) {
    throw new TypeError(`definition list entries must be an array, got ${describe(entries)}`);
  }
  const nodes = entries.flatMap((entry): RootContent[] => {
    if (!isArray(entry) || entry.length !== 2) {
      throw new TypeError(`definition list entry must be a [term, definition] pair, got ${describe(entry)}`);
    }
    const [term, definition] = entry;
    return [
      ...wrapped('', 'dt', term, '\n<dd>', 'definition term'),
      ...groupedNodes([definition], 'definition'),
      html('</dd>'),
    ];
  });
  return new MarkdownElement('block', 'definitionList', 'a definition list', [html('<dl>'), ...nodes, html('</dl>')]);
}

/** The same as {@link dl}. */
export const definitionList: typeof dl = dl;

/**
 * Creates a table whose cells can hold anything, including lists and paragraphs.
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
  if (!isArray(header)) throw new TypeError(`table header must be an array, got ${describe(header)}`);
  if (!isArray(rows)) throw new TypeError(`table rows must be an array, got ${describe(rows)}`);
  for (const row of rows) {
    if (!isArray(row)) throw new TypeError(`table row must be an array, got ${describe(row)}`);
  }
  const columns = rows.reduce((n, row) => Math.max(n, row.length), header.length);
  const align = (options?.align ?? []).map(alignOf);
  const nodes: RootContent[] = [];
  // Tags written since the last cell with Markdown. They form one HTML node, since nodes are joined by blank lines.
  let tags = '<table>\n';

  function flush(): void {
    nodes.push(html(tags.replace(/\n$/, '')));
    tags = '';
  }

  function addRow(tag: 'th' | 'td', cells: readonly AnyContent[]): void {
    tags += '<tr>\n';
    for (let i = 0; i < columns; ++i) {
      const open = align[i] ? `<${tag} align="${align[i]}">` : `<${tag}>`;
      const blocks = withoutEmptyNodes(cellNodes(cells[i] ?? []));
      const text = plainText(blocks);
      if (text !== undefined) {
        tags += `${open}${text}</${tag}>\n`;
        continue;
      }
      tags += open;
      flush();
      nodes.push(...blocks);
      tags = `</${tag}>\n`;
    }
    tags += '</tr>\n';
  }

  if (header.length) {
    tags += '<thead>\n';
    addRow('th', header);
    tags += '</thead>\n';
  }
  tags += '<tbody>\n';
  rows.forEach((row) => addRow('td', row));
  tags += '</tbody>\n</table>';
  flush();
  return new MarkdownElement('block', 'htmlTable', 'an HTML table', nodes);
}

/**
 * Inline content in an HTML element, with HTML written before and after it.
 * Plain text goes on one line, HTML-escaped, since Markdown isn't read there. Anything else gets blank lines, so it renders.
 */
function wrapped(before: string, tag: string, content: InlineContent, after: string, where: string): RootContent[] {
  const children = withoutEmptyNodes(inlineNodes(content, where));
  if (children.every((node) => node.type === 'text')) {
    const text = htmlEscape(children.map((node) => node.value).join(''));
    return [html(`${before}<${tag}>${text}</${tag}>${after}`)];
  }
  return [html(`${before}<${tag}>`), { type: 'paragraph', children }, html(`</${tag}>${after}`)];
}

/** Text for an HTML block: `&` and `<` escaped, and no blank line, which would end the block. */
function htmlEscape(text: string): string {
  return text
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

/** The blocks of a table cell, grouped as in a document, with each line ending in a string as a line break. */
function cellNodes(content: AnyContent): RootContent[] {
  return mapParagraphsAndBlocks(
    content,
    (inline): RootContent => ({ type: 'paragraph', children: inline.flatMap(cellInlineNodes) }),
    (block) => blockNodes(block, 'table cell'),
  );
}

function cellInlineNodes(content: InlineContent): PhrasingContent[] {
  if (isArray(content)) return content.flatMap(cellInlineNodes);
  const nodes = inlineNodes(content, 'table cell');
  return typeof content === 'string' || isText(content) ? nodes.flatMap(lineBreaks) : nodes;
}

/** A text node with each line ending, and the spaces around it, as a line break. */
function lineBreaks(node: PhrasingContent): PhrasingContent[] {
  if (node.type !== 'text') return [node];
  return node.value
    .split(/[ \t]*(?:\r\n?|\n)[ \t]*/)
    .flatMap((value, i): PhrasingContent[] => [
      ...(i ? [{ type: 'break' } as const] : []),
      ...(value ? [{ type: 'text', value } as const] : []),
    ]);
}

/**
 * A cell's HTML when it can stay on its tag's line: empty, or one paragraph of text and line breaks.
 * `undefined` means the cell has Markdown and needs blank lines around it.
 */
function plainText(blocks: RootContent[]): string | undefined {
  if (!blocks.length) return '';
  const [first] = blocks;
  if (blocks.length !== 1 || first.type !== 'paragraph') return undefined;
  const children = first.children;
  if (!children.every((node) => node.type === 'text' || node.type === 'break')) return undefined;
  // A line break at the start or end can't display, as in a paragraph.
  return children
    .map((node) => (node.type === 'text' ? node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '<br/>'))
    .join('')
    .replace(/^(?:<br\/>)+|(?:<br\/>)+$/g, '');
}

function html(value: string): Html {
  return { type: 'html', value };
}
