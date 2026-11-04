import {
  groupedNodes,
  inlineNodes,
  isBlockContent,
  isListItem,
  mapParagraphsAndBlocks,
  MarkdownElement,
} from '../element/index.ts';
import type {
  AnyContent,
  BlockContent,
  HeadingDepth,
  InlineContent,
  MDBlock,
  MDHeading,
  MDHorizontalRule,
  MDParagraph,
} from '../types.ts';

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
