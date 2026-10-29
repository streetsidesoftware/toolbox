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
  MarkdownElement,
  renderingOf,
  runs,
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
 * Whether a value is a Markdown element.
 * @category Existing Markdown
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
 * Text, for use inside a line. A `{​@ name @​}` placeholder in it is kept as written.
 *
 * A newline stays in the text, and displays as a space.
 * @category Text
 */
export function inlineText(value: string): MDText {
  return new TextElement(value);
}

/** The same as {@link inlineText}. */
export const text: typeof inlineText = inlineText;

/**
 * Plain text as paragraphs.
 * - A blank line, or a line of only spaces and tabs, ends a paragraph.
 * - Other lines are escaped, as in {@link inlineText}, and a newline between them displays as a space.
 * - Blank lines at the start and end are dropped.
 * @category Text
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
 * A `{​@ name @​}` placeholder that goes where inline content does, rendered exactly as written so it can be substituted later.
 * - Inside a line, it takes only inline content.
 * - On a line of its own, where blocks can go, it also takes blocks.
 * - It is also accepted inside code.
 * @category Templates
 */
export function placeholder(name: string): MDPlaceholder {
  checkPlaceholderName(name);
  return new PlaceholderElement(name);
}

/**
 * A `{​@ name @​}` placeholder on its own lines, rendered exactly as written so it can be substituted later.
 *
 * It takes blocks or inline content.
 * @category Templates
 */
export function blockPlaceholder(name: string): MDBlockPlaceholder {
  checkPlaceholderName(name);
  return new BlockPlaceholderElement(name);
}

function checkPlaceholderName(name: string): void {
  if (!isValidPlaceholderName(name)) throw new Error(`invalid placeholder name: "${name}"`);
}

/**
 * A link, `[content](url)`.
 * @category Links and formatting
 */
export function link(content: InlineContent, url: string | URL): MDLink {
  const href = typeof url === 'string' ? url : url.href;
  return new MarkdownElement('inline', 'link', 'a link', [
    { type: 'link', url: href, children: inlineNodes(content, 'link content') },
  ]);
}

/**
 * Strong text, `**content**`.
 * @category Links and formatting
 */
export function strong(content: InlineContent): MDStrong {
  return new MarkdownElement('inline', 'strong', 'strong text', [
    { type: 'strong', children: inlineNodes(content, 'strong content') },
  ]);
}

/**
 * Emphasized text, `_content_`.
 * @category Links and formatting
 */
export function emphasis(content: InlineContent): MDEmphasis {
  return new MarkdownElement('inline', 'emphasis', 'emphasized text', [
    { type: 'emphasis', children: inlineNodes(content, 'emphasis content') },
  ]);
}

/**
 * Struck-through text, `~~content~~`.
 * @category Links and formatting
 */
export function strikethrough(content: InlineContent): MDStrikethrough {
  return new MarkdownElement('inline', 'strikethrough', 'struck-through text', [
    { type: 'delete', children: inlineNodes(content, 'strikethrough content') },
  ]);
}

/**
 * Inline code. The code is inserted as is.
 * @category Code
 */
export function inlineCode(code: string): MDInlineCode {
  return new MarkdownElement('inline', 'inlineCode', 'inline code', [{ type: 'inlineCode', value: code }]);
}

/**
 * A line break in the form that works where it ends up.
 *
 * In a paragraph or list item it's a Markdown hard break, a `\` at the end of the line.
 * @category Line breaks and comments
 */
export function lineBreak(): MDLineBreak {
  return new MarkdownElement('inline', 'lineBreak', 'a line break', [{ type: 'break' }]);
}

/**
 * An HTML line break, always `<br/>`. It's self-closed, so it also works in MDX.
 * @category Line breaks and comments
 */
export function br(): MDBr {
  return new MarkdownElement('inline', 'br', 'a <br/>', [{ type: 'html', value: '<br/>' }]);
}

/**
 * An HTML comment, `<!-- text -->`. It goes inside a line or on its own.
 * @category Line breaks and comments
 */
export function comment(text: string): MDComment {
  return new MarkdownElement('comment', 'comment', 'a comment', [
    { type: 'html', value: `<!-- ${commentSafe(text)} -->` },
  ]);
}

/**
 * A heading, `## content`.
 * @category Headings and sections
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
 * A paragraph: inline content as a block.
 * @category Text
 */
export function paragraph(...content: InlineContent[]): MDParagraph {
  return paragraphOf(content, 'paragraph content');
}

/** The same as {@link paragraph}. */
export const p: typeof paragraph = paragraph;

function paragraphOf(content: readonly InlineContent[], where: string): MDParagraph {
  return new MarkdownElement('block', 'paragraph', 'a paragraph', [
    { type: 'paragraph', children: inlineNodes(content, where) },
  ]);
}

/**
 * Content as blocks, for where only blocks can go.
 * - Blocks are returned unchanged.
 * - Each run of inline pieces becomes a paragraph, as in a list item.
 * @category Existing Markdown
 */
export function toBlock(content: AnyContent): BlockContent {
  if (isBlockContent(content)) return content;
  const blocks = runs(content).map((run) => ('inline' in run ? paragraphOf(run.inline, 'block content') : run.block));
  return blocks.length === 1 ? blocks[0] : blocks;
}

/**
 * A horizontal rule, a line between sections: `---` in the default style.
 * @category Headings and sections
 */
export function horizontalRule(): MDHorizontalRule {
  return new MarkdownElement('block', 'horizontalRule', 'a horizontal rule', [{ type: 'thematicBreak' }]);
}

/** The same as {@link horizontalRule}. */
export const hr: typeof horizontalRule = horizontalRule;

/**
 * A fenced code block. The code is inserted as is.
 * @category Code
 */
export function codeBlock(code: string, lang?: string): MDCodeBlock {
  return new MarkdownElement('block', 'codeBlock', 'a code block', [{ type: 'code', lang: lang || null, value: code }]);
}

/**
 * One list item from several pieces, for use in {@link list}.
 * @category Lists and tables
 */
export function listItem(...content: ListItemContent[]): MDListItem {
  return new MarkdownElement('listItem', 'listItem', 'a list item', [listItemNode(content)]);
}

/**
 * A whole document. Arrays are flattened.
 *
 * Inline pieces in a row form a paragraph, and blocks follow, as in a list item.
 * Frontmatter goes first.
 * @category Whole pages
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
 * A bulleted list, one item per entry.
 * @category Lists and tables
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
