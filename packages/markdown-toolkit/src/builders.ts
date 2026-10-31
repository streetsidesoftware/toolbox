import { isValidPlaceholderName } from '@streetsidesoftware/placeholders';
import type { ListItem, Paragraph } from 'mdast';

import { DocumentElement } from './documentElement.ts';
import { isFrontmatter } from './frontmatter.ts';
import {
  describe,
  groupedNodes,
  inlineNodes,
  isArray,
  isBlockContent,
  isListItem,
  listItemNode,
  mapParagraphsAndBlocks,
  MarkdownElement,
  renderingOf,
  textNodes,
} from './nodes.ts';
import { placeholderNode } from './placeholderNode.ts';
import type {
  AnyContent,
  BlockContent,
  HeadingDepth,
  InlineContent,
  ListEntry,
  ListItemContent,
  ListItemOptions,
  ListOptions,
  MDBlock,
  MDBlockPlaceholder,
  MDBr,
  MDCodeBlock,
  MDComment,
  MDDocument,
  MDElement,
  MDEmphasis,
  MDFragment,
  MDFrontmatter,
  MDHeading,
  MDHorizontalRule,
  MDInlineCode,
  MDLineBreak,
  MDLink,
  MDList,
  MDListItem,
  MDParagraph,
  MDPlaceholder,
  MDStrikethrough,
  MDStrong,
  MDText,
  OrderedListOptions,
} from './types.ts';

class TextElement extends MarkdownElement<'inline', 'text'> implements MDText {
  readonly text: string;

  constructor(text: string) {
    super('inline', 'text', 'text', textNodes(text));
    this.text = text;
  }
}

class PlaceholderElement extends MarkdownElement<'inline', 'placeholder'> implements MDPlaceholder {
  readonly name: string;

  constructor(name: string) {
    super('inline', 'placeholder', 'a placeholder', [placeholderNode(name)]);
    this.name = name;
  }
}

class BlockPlaceholderElement extends MarkdownElement<'block', 'blockPlaceholder'> implements MDBlockPlaceholder {
  readonly name: string;

  constructor(name: string) {
    super('block', 'blockPlaceholder', 'a block placeholder', [
      { type: 'paragraph', children: [placeholderNode(name)] },
    ]);
    this.name = name;
  }
}

/**
 * Check whether a value is an element made by this library, such as a paragraph or a link.
 *
 * @example
 * md.isMarkdown(md.p('Hi'));
 * // true
 * md.isMarkdown('Hi');
 * // false
 * @category elements
 */
export function isMarkdown(value: unknown): value is MDElement {
  return renderingOf(value) !== undefined;
}

/**
 * Return comment text that can't end the comment early.
 * HTML ends a comment at `-->` or `--!>`.
 */
function commentSafe(text: string): string {
  return text.replace(/--(!?)>/g, '-- $1>');
}

/**
 * Create text that shows exactly as given, even if it contains Markdown or HTML.
 *
 * @example
 * md.text('Use <details> for *long* notes');
 * // The page shows: Use <details> for *long* notes
 * @category text
 */
export function text(value: string): MDText {
  return new TextElement(value);
}

/** The same as {@link text}. */
export const inlineText: typeof text = text;

/**
 * Create paragraphs from plain text, starting a new one at each blank line.
 *
 * The text shows exactly as given, even if it contains Markdown or HTML.
 *
 * @example
 * md.blockText('First paragraph.\n\nSecond paragraph.');
 * // First paragraph.
 * //
 * // Second paragraph.
 * @category text
 */
export function blockText(value: string): MDFragment {
  const paragraphs: Paragraph[] = [];
  let lines: string[] = [];
  const endParagraph = (): void => {
    if (lines.length) paragraphs.push({ type: 'paragraph', children: textNodes(lines.join('\n')) });
    lines = [];
  };
  for (const line of value.split(/\r\n?|\n/)) {
    if (/^[ \t]*$/.test(line)) {
      endParagraph();
      continue;
    }
    lines.push(line);
  }
  endParagraph();
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', paragraphs);
}

/**
 * Create a `{​@ name @​}` placeholder for a value to be substituted later.
 *
 * - Within a sentence, it takes text, links, formatting or code.
 * - On a line of its own, it can also take a list, table or other block.
 *
 * @example
 * const page = md.p('Hello ', md.placeholder('name'), '.');
 * md.substitutePlaceholders(page, { name: 'world' });
 * // Hello world.
 * @category placeholders
 */
export function placeholder(name: string): MDPlaceholder {
  checkPlaceholderName(name);
  return new PlaceholderElement(name);
}

/**
 * Create a `{​@ name @​}` placeholder on lines of its own, for a value to be substituted later.
 *
 * It takes any value, including a list, table or other block.
 *
 * @example
 * md.substitutePlaceholders(md.blockPlaceholder('languages'), { languages: md.list(['Dutch', 'French']) });
 * // - Dutch
 * // - French
 * @category placeholders
 */
export function blockPlaceholder(name: string): MDBlockPlaceholder {
  checkPlaceholderName(name);
  return new BlockPlaceholderElement(name);
}

function checkPlaceholderName(name: string): void {
  if (!isValidPlaceholderName(name)) throw new Error(`invalid placeholder name: "${name}"`);
}

/**
 * Create a link that shows `content` and goes to `url`.
 *
 * @example
 * md.link('the docs', 'https://example.com');
 * // [the docs](https://example.com)
 * @category links
 */
export function link(content: InlineContent, url: string | URL): MDLink {
  const href = typeof url === 'string' ? url : url.href;
  return new MarkdownElement('inline', 'link', 'a link', [
    { type: 'link', url: href, children: inlineNodes(content, 'link content') },
  ]);
}

/**
 * Create bold text.
 *
 * Empty text shows as one bold space.
 *
 * @example
 * md.strong('important');
 * // **important**
 * @category formatting
 */
export function strong(content: InlineContent): MDStrong {
  return new MarkdownElement('inline', 'strong', 'strong text', [
    { type: 'strong', children: inlineNodes(content, 'strong content') },
  ]);
}

/**
 * Create italic text.
 *
 * Empty text shows as one italic space.
 *
 * @example
 * md.emphasis('maybe');
 * // _maybe_
 * @category formatting
 */
export function emphasis(content: InlineContent): MDEmphasis {
  return new MarkdownElement('inline', 'emphasis', 'emphasized text', [
    { type: 'emphasis', children: inlineNodes(content, 'emphasis content') },
  ]);
}

/**
 * Create text with a line through it.
 *
 * Empty text shows as one struck-through space.
 *
 * @example
 * md.strikethrough('old price');
 * // ~~old price~~
 * @category formatting
 */
export function strikethrough(content: InlineContent): MDStrikethrough {
  return new MarkdownElement('inline', 'strikethrough', 'struck-through text', [
    { type: 'delete', children: inlineNodes(content, 'strikethrough content') },
  ]);
}

/**
 * Create code within a line of text, shown exactly as given.
 *
 * Empty code shows as one space of code, so the reader still sees it.
 *
 * @example
 * md.inlineCode('npm install');
 * // `npm install`
 * @category code
 */
export function inlineCode(code: string): MDInlineCode {
  return new MarkdownElement('inline', 'inlineCode', 'inline code', [{ type: 'inlineCode', value: code }]);
}

/**
 * Start a new line without starting a new paragraph.
 *
 * It works anywhere a string can go, even in a heading or a table cell.
 *
 * @example
 * md.p('Line one', md.lineBreak(), 'line two');
 * // The page shows "Line one" and "line two" on separate lines.
 * @category line-breaks
 */
export function lineBreak(): MDLineBreak {
  return new MarkdownElement('inline', 'lineBreak', 'a line break', [{ type: 'break' }]);
}

/**
 * Start a new line with an HTML `<br/>` tag.
 *
 * The Markdown always contains `<br/>`, wherever it goes.
 *
 * @example
 * md.p('Line one', md.br(), 'line two');
 * // Line one<br/>line two
 * @category line-breaks
 */
export function br(): MDBr {
  return new MarkdownElement('inline', 'br', 'a <br/>', [{ type: 'html', value: '<br/>' }]);
}

/**
 * Create an HTML comment, `<!-- text -->`, which the page doesn't show.
 *
 * It works anywhere a string can go, or on its own line between paragraphs.
 *
 * @example
 * md.comment('cspell:ignore gezellig');
 * // <!-- cspell:ignore gezellig -->
 * @category comments
 */
export function comment(text: string): MDComment {
  return new MarkdownElement('comment', 'comment', 'a comment', [
    { type: 'html', value: `<!-- ${commentSafe(text)} -->` },
  ]);
}

/**
 * Create a heading.
 *
 * @param depth - 1 for the page title, 2 for its sections, and so on down to 6.
 * @example
 * md.heading(2, 'Install');
 * // ## Install
 * @category headings
 */
export function heading(depth: HeadingDepth, content: InlineContent): MDHeading {
  if (!Number.isInteger(depth) || depth < 1 || depth > 6) {
    throw new Error(`heading depth must be 1 to 6, got ${String(depth)}`);
  }
  return new MarkdownElement('block', 'heading', 'a heading', [
    { type: 'heading', depth, children: inlineNodes(content, 'heading content') },
  ]);
}

/**
 * Create a paragraph from one or more pieces, such as strings and links.
 *
 * The pieces are joined as given, with no spaces added. A string is always text, even if it looks like Markdown.
 *
 * - For a string that's already Markdown, use {@link parse}.
 * - For plain text where blank lines should separate paragraphs, use {@link blockText}.
 *
 * An empty paragraph shows nothing and leaves no gap.
 *
 * @example
 * md.p('One sentence.', ' Another one.');
 * // One sentence. Another one.
 * @category text
 */
export function p(...content: InlineContent[]): MDParagraph {
  return paragraphOf(content, 'paragraph content');
}

/** The same as {@link p}. */
export const paragraph: typeof p = p;

function paragraphOf(content: readonly InlineContent[], where: string): MDParagraph {
  return new MarkdownElement('block', 'paragraph', 'a paragraph', [
    { type: 'paragraph', children: inlineNodes(content, where) },
  ]);
}

/**
 * Put text, links and other pieces in a paragraph of their own.
 *
 * Paragraphs, lists and other blocks stay as they are.
 *
 * @example
 * md.toBlock(['Some ', md.strong('bold'), ' text.']);
 * // Some **bold** text.
 * @category elements
 */
export function toBlock(content: AnyContent): BlockContent {
  if (isBlockContent(content)) return content;
  const blocks = mapParagraphsAndBlocks(
    content,
    (inline) => paragraphOf(inline, 'block content'),
    (block) => block,
  );
  if (!blocks.every((block): block is MDBlock => !isListItem(block))) {
    return new MarkdownElement('block', 'fragment', 'a Markdown fragment', groupedNodes(content, 'block content'));
  }
  return blocks.length === 1 ? blocks[0] : blocks;
}

/**
 * Create a line across the page, to separate sections.
 *
 * @example
 * md.hr();
 * // ---
 * @category sections
 */
export function hr(): MDHorizontalRule {
  return new MarkdownElement('block', 'horizontalRule', 'a horizontal rule', [{ type: 'thematicBreak' }]);
}

/** The same as {@link hr}. */
export const horizontalRule: typeof hr = hr;

/**
 * Create a block of code, shown exactly as given.
 *
 * @param lang - the language, such as `ts` or `sh`, so the page can highlight the code.
 * @example
 * md.codeBlock('npm install', 'sh');
 * // ```sh
 * // npm install
 * // ```
 * @category code
 */
export function codeBlock(code: string, lang?: string): MDCodeBlock {
  return new MarkdownElement('block', 'codeBlock', 'a code block', [{ type: 'code', lang: lang || null, value: code }]);
}

/**
 * Create one list item from several pieces.
 *
 * Pieces in a row join into one line. A paragraph, list or other block goes on its own lines below them.
 *
 * It goes in a {@link list}, or anywhere a paragraph can go:
 * - List items in a row form a list.
 * - A list item right before or after a list becomes one more item of it.
 * - In a heading, a link or anywhere else inside a line, a list item is an error.
 *
 * Options can follow the pieces. With `{ checked: true }` the page shows a checked box, and with `{ checked: false }`
 * an empty one. Without `checked`, the item has no box.
 *
 * @example
 * md.listItem('Dutch', md.list(['Flemish']));
 * // - Dutch
 * //   - Flemish
 * @example
 * md.listItem('Write tests', { checked: true });
 * // Markdown:
 * // - [x] Write tests
 * // The page shows a checked box next to "Write tests".
 * @category lists
 */
export function listItem(
  ...content:
    [ListItemContent, ...ListItemContent[]] | [ListItemContent, ...ListItemContent[], ListItemOptions | undefined]
): MDListItem {
  return buildListItem(...piecesAndOptions(content));
}

/** The same as {@link listItem}. */
export const li: typeof listItem = listItem;

function isListItemOptions(value: ListItemOptions | ListItemContent | undefined): value is ListItemOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isMarkdown(value);
}

function buildListItem(content: readonly ListItemContent[], options?: ListItemOptions): MDListItem {
  const item = listItemNode(content);
  if (options?.checked !== undefined) item.checked = options.checked;
  return new MarkdownElement('listItem', 'listItem', 'a list item', [item]);
}

/**
 * Create one task list item: a list item with a checkbox.
 *
 * Pieces in a row join into one line. A paragraph, list or other block goes on its own lines below them.
 *
 * It goes in a {@link list}, or anywhere a paragraph can go:
 * - List items in a row form a list.
 * - A list item right before or after a list becomes one more item of it.
 * - In a heading, a link or anywhere else inside a line, a list item is an error.
 *
 * Options can follow the pieces. The box is empty unless they hold `{ checked: true }`.
 *
 * @example
 * md.taskListItem('Ship');
 * // Markdown:
 * // - [ ] Ship
 * // The page shows an empty box next to "Ship".
 * @category lists
 */
export function taskListItem(
  ...content:
    [ListItemContent, ...ListItemContent[]] | [ListItemContent, ...ListItemContent[], ListItemOptions | undefined]
): MDListItem {
  const [pieces, options] = piecesAndOptions(content);
  return buildListItem(pieces, { checked: options?.checked ?? false });
}

/** Split a list item's arguments into its pieces and the options that can follow them. */
function piecesAndOptions(
  content: readonly (ListItemContent | ListItemOptions | undefined)[],
): [pieces: ListItemContent[], options: ListItemOptions | undefined] {
  const last = content.at(-1);
  if (last !== undefined && !isListItemOptions(last)) return [content as ListItemContent[], undefined];
  return [content.slice(0, -1) as ListItemContent[], last];
}

/**
 * Create a whole Markdown file from its parts, in order.
 *
 * - Frontmatter, if any, goes first.
 * - An array of parts works the same as passing them one by one.
 *
 * @example
 * md.document(md.heading(1, 'Title'), md.p('Body.'));
 * // # Title
 * //
 * // Body.
 * @category documents
 */
export function document(frontmatter: MDFrontmatter, ...content: AnyContent[]): MDDocument;
export function document(...content: AnyContent[]): MDDocument;
export function document(...content: (MDFrontmatter | AnyContent)[]): MDDocument {
  const [first, ...rest] = content;
  if (rest.some(isFrontmatter)) throw new TypeError('frontmatter must be the first content of a document');
  if (!isFrontmatter(first)) return new DocumentElement(groupedNodes(content as AnyContent[], 'document content'));
  return new DocumentElement([
    ...(renderingOf(first)?.nodes ?? []),
    ...groupedNodes(rest as AnyContent[], 'document content'),
  ]);
}

/**
 * Create a bulleted or numbered list, one item per entry.
 *
 * An entry can be an array of pieces, and a list among them makes a nested list.
 *
 * The list is bulleted unless `ordered` is `true`. For one kind only, {@link ul} and {@link ol} are shorter.
 *
 * @param options - `ordered: true` numbers the items. `start` sets the first number, a whole number from 0 to
 * 999999999, and goes only with `ordered: true`.
 * @example <caption>A list</caption>
 * md.list(['Dutch', 'French', 'German']);
 * // - Dutch
 * // - French
 * // - German
 * @example <caption>Nested lists</caption>
 * md.list([['Nested:', md.list(['Item 1', 'Item 2'])], 'Item 3']);
 * // - Nested:
 * //   - Item 1
 * //   - Item 2
 * // - Item 3
 * @category lists
 */
export function list(entries: readonly ListEntry[], options?: ListOptions): MDList {
  if (!Array.isArray(entries)) throw new TypeError(`list entries must be an array, got ${describe(entries)}`);
  // The type allows `start` only with `ordered: true`; JavaScript callers can still pass it alone.
  const { ordered = false, start } = (options ?? {}) as { ordered?: boolean; start?: number };
  if (start !== undefined && !(Number.isInteger(start) && start >= 0 && start <= 999_999_999)) {
    const given = typeof start === 'number' ? String(start) : describe(start);
    throw new TypeError(`a list start must be a whole number from 0 to 999999999, got ${given}`);
  }
  const items = entries.map((entry) =>
    isListItem(entry) ? (renderingOf(entry)?.nodes[0] as ListItem) : listItemNode(isArray(entry) ? entry : [entry]),
  );
  return new MarkdownElement('block', 'list', 'a list', [
    { type: 'list', ordered, start: ordered ? (start ?? 1) : null, spread: false, children: items },
  ]);
}

/**
 * Create a numbered list, one item per entry.
 *
 * It's the same as {@link list} with `ordered: true`.
 *
 * @param options - `start` sets the first number, a whole number from 0 to 999999999. It's 1 by default.
 * @example
 * md.ol(['Install', 'Run'], { start: 3 });
 * // Markdown:
 * // 3. Install
 * // 3. Run
 * // The page shows a numbered list: 3. Install, 4. Run.
 * @category lists
 */
export function ol(entries: readonly ListEntry[], options?: OrderedListOptions): MDList {
  return list(entries, { ...options, ordered: true });
}

/**
 * Create a bulleted list, one item per entry.
 *
 * It's the same as {@link list} with no options.
 *
 * @example
 * md.ul(['Dutch', 'French']);
 * // Markdown:
 * // - Dutch
 * // - French
 * // The page shows a bulleted list: Dutch, French.
 * @category lists
 */
export function ul(entries: readonly ListEntry[]): MDList {
  return list(entries);
}
