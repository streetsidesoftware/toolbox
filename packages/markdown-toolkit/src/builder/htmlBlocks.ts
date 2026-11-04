import { hasPlaceholders } from '@streetsidesoftware/placeholders';
import type { Html, PhrasingContent, RootContent } from 'mdast';

import {
  argumentNodes,
  blockNodes,
  describe,
  groupedNodes,
  inlineNodes,
  inLists,
  isArray,
  mapParagraphsAndBlocks,
  MarkdownElement,
} from '../element/index.ts';
import { trimBlanks, trimBlanksAroundBreaks, trimLineEdges } from '../mdast/index.ts';
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
    ...wrapped('<details>\n', 'summary', summary, '', 'details summary'),
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
      const blocks = cellNodes(cells[i] ?? []);
      const markup = writeCell(blocks);
      if (markup !== undefined) {
        tags += `${open}${markup}</${tag}>\n`;
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
 * Return the nodes for inline content in an HTML element, with HTML written before and after it.
 * It goes on one line as HTML, since Markdown isn't read there. Content {@link writeLine} can't write gets blank lines,
 * so it renders.
 */
function wrapped(before: string, tag: string, content: InlineContent, after: string, where: string): RootContent[] {
  const children = trimBlanks(inlineNodes(content, where));
  const markup = writeLine(children);
  if (markup !== undefined) return [html(`${before}<${tag}>${markup}</${tag}>${after}`)];
  return [html(`${before}<${tag}>`), { type: 'paragraph', children }, html(`</${tag}>${after}`)];
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

/**
 * Return a cell's HTML when it can stay on its tag's line: empty, or one paragraph that {@link writeLine} can write.
 * Return `undefined` when the cell needs blank lines around it.
 */
function writeCell(blocks: RootContent[]): string | undefined {
  if (!blocks.length) return '';
  const [first] = blocks;
  if (blocks.length !== 1 || first.type !== 'paragraph') return undefined;
  return writeLine(first.children);
}

/**
 * Return inline content as HTML for one line, or `undefined` when it has to stay Markdown.
 * Content with a placeholder stays Markdown: inside HTML, a placeholder takes only a string or an entity, and a string
 * isn't escaped. The check is on the finished line, so it also finds one written in code or a URL, or split across text.
 * A line break at its start or end can't display, as in a paragraph, so it goes.
 */
function writeLine(children: readonly PhrasingContent[]): string | undefined {
  const markup = writeInline(trimLineEdges(trimBlanksAroundBreaks(children)));
  return markup === undefined || hasPlaceholders(markup) ? undefined : markup;
}

function writeInline(nodes: readonly PhrasingContent[]): string | undefined {
  let markup = '';
  for (const node of trimBlanksAroundBreaks(nodes)) {
    const written = writeNode(node);
    if (written === undefined) return undefined;
    markup += written;
  }
  return markup;
}

/**
 * Return one inline node as HTML, or `undefined` when it has to stay Markdown:
 * - It's a placeholder.
 * - It's HTML, a URL, a title or alt text with a blank line in it, which would end the HTML block.
 * - It has no HTML form, such as a reference, whose URL is in a definition that only Markdown can look up.
 *
 * A line ending in text, which a parsed paragraph can have, stays: it can't be a blank line.
 */
function writeNode(node: PhrasingContent): string | undefined {
  switch (node.type) {
    case 'text':
      return htmlEscape(node.value);
    case 'break':
      return '<br/>';
    case 'htmlEntity':
      return node.value;
    case 'html':
    case 'inlineHtml':
      return hasBlankLine(node.value) ? undefined : node.value;
    case 'inlineCode':
      // Empty code shows as one space, and a line ending as a space, as in Markdown.
      return `<code>${htmlEscape(node.value.replace(/\r\n?|\n/g, ' ') || ' ')}</code>`;
    case 'strong':
      return writeFormatting('strong', node.children);
    case 'emphasis':
      return writeFormatting('em', node.children);
    case 'delete':
      return writeFormatting('del', node.children);
    case 'link': {
      const attributes = writeAttributes(['href', node.url], ['title', node.title]);
      const inner = writeInline(node.children);
      return attributes === undefined || inner === undefined ? undefined : `<a${attributes}>${inner}</a>`;
    }
    case 'image': {
      const attributes = writeAttributes(['src', node.url], ['alt', node.alt], ['title', node.title]);
      return attributes === undefined ? undefined : `<img${attributes}/>`;
    }
    default:
      return undefined;
  }
}

/** Return formatting as HTML. Empty formatting shows as one formatted space, as in Markdown. */
function writeFormatting(tag: string, children: readonly PhrasingContent[]): string | undefined {
  const inner = writeInline(children);
  return inner === undefined ? undefined : `<${tag}>${inner || ' '}</${tag}>`;
}

/** Return the attributes that have a value, or `undefined` when one holds a blank line. */
function writeAttributes(...attributes: readonly [string, string | null | undefined][]): string | undefined {
  let markup = '';
  for (const [name, value] of attributes) {
    if (value === null || value === undefined) continue;
    if (hasBlankLine(value)) return undefined;
    markup += ` ${name}="${htmlEscape(value).replace(/"/g, '&quot;')}"`;
  }
  return markup;
}

/** Check for a blank line inside the text. Its first and last lines have tags or quotes next to them, so they aren't blank. */
function hasBlankLine(text: string): boolean {
  return text
    .split(/\r\n?|\n/)
    .slice(1, -1)
    .some((line) => !line.trim());
}

function htmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function html(value: string): Html {
  return { type: 'html', value };
}
