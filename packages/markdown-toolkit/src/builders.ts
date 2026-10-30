import { isValidPlaceholderName } from '@streetsidesoftware/placeholders';
import type { ListItem, Paragraph } from 'mdast';

import { DocumentElement } from './documentElement.ts';
import { isFrontmatter } from './frontmatter.ts';
import {
  describe,
  groupedNodes,
  hasLink,
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
 * Checks whether a value is an element made by this library, such as a paragraph or a link.
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
 * Comment text that can't end the comment early.
 * HTML ends a comment at `-->` or `--!>`.
 */
function commentSafe(text: string): string {
  return text.replace(/--(!?)>/g, '-- $1>');
}

/**
 * Creates text that shows exactly as given, even if it contains Markdown or HTML.
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
 * Creates paragraphs from plain text, starting a new one at each blank line.
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
 * Creates a `{​@ name @​}` placeholder for a value to be substituted later.
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
 * Creates a `{​@ name @​}` placeholder on lines of its own, for a value to be substituted later.
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
 * The content can hold text, formatting or code, but not another link. A page can't show a link inside a link.
 *
 * @example
 * md.link('the docs', 'https://example.com');
 * // [the docs](https://example.com)
 * @category links
 */
export function link(content: InlineContent, url: string | URL): MDLink {
  const href = typeof url === 'string' ? url : url.href;
  const children = inlineNodes(content, 'link content');
  if (hasLink(children)) throw new TypeError("link content can't hold a link, got a link");
  return new MarkdownElement('inline', 'link', 'a link', [{ type: 'link', url: href, children }]);
}

/**
 * Creates bold text.
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
 * Creates italic text.
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
 * Creates text with a line through it.
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
 * Creates code within a line of text, shown exactly as given.
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
 * Starts a new line without starting a new paragraph.
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
 * Starts a new line with an HTML `<br/>` tag.
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
 * Creates an HTML comment, `<!-- text -->`, which the page doesn't show.
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
 * Creates a heading.
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
 * Creates a paragraph from one or more pieces, such as strings and links.
 *
 * The pieces are joined as given, with no spaces added. A string is always text, even if it looks like Markdown.
 *
 * - For a string that's already Markdown, use {@link parse}.
 * - For plain text where blank lines should separate paragraphs, use {@link blockText}.
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
 * Puts text, links and other pieces in a paragraph of their own, and leaves paragraphs, lists and other blocks as they are.
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
  return blocks.length === 1 ? blocks[0] : blocks;
}

/**
 * Creates a line across the page, to separate sections.
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
 * Creates a block of code, shown exactly as given.
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
 * Creates one list item from several pieces, for use in {@link list}.
 *
 * Pieces in a row join into one line. A paragraph, list or other block goes on its own lines below them.
 *
 * @example
 * md.listItem('Dutch', md.list(['Flemish']));
 * // - Dutch
 * //   - Flemish
 * @category lists
 */
export function listItem(...content: ListItemContent[]): MDListItem {
  return new MarkdownElement('listItem', 'listItem', 'a list item', [listItemNode(content)]);
}

/**
 * Creates a whole Markdown file from its parts, in order.
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
 * Creates a bulleted list, one item per entry.
 *
 * An entry can be an array of pieces, and a list among them makes a nested list.
 *
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
export function list(entries: readonly ListEntry[]): MDList {
  if (!Array.isArray(entries)) throw new TypeError(`list entries must be an array, got ${describe(entries)}`);
  const items = entries.map((entry) =>
    isListItem(entry) ? (renderingOf(entry)?.nodes[0] as ListItem) : listItemNode(isArray(entry) ? entry : [entry]),
  );
  return new MarkdownElement('block', 'list', 'a list', [
    { type: 'list', ordered: false, spread: false, children: items },
  ]);
}
