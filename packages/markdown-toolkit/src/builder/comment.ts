import type { Html, PhrasingContent } from 'mdast';

import { MarkdownElement } from '../element/index.ts';
import { inlineHtmlNode } from '../mdast/index.ts';
import type { MDBlockComment, MDComment, MDInlineComment } from '../types.ts';

/**
 * Create an HTML comment, which the page doesn't show, in the form that fits its text.
 *
 * Text without a line ending makes a comment like {@link inlineComment}. It works anywhere a string can go, or on its
 * own line between paragraphs.
 *
 * Text with a line ending makes a comment like {@link blockComment}, even at the very start or end of the text. It
 * goes on its own lines, not inside a line, such as in a paragraph or a summary.
 *
 * The form comes from the text given here. A value substituted for a placeholder goes in as given and doesn't change
 * the form, so for a value with several lines, use {@link blockComment}.
 *
 * @example
 * md.comment('cspell:ignore gezellig');
 * // <!-- cspell:ignore gezellig -->
 * @category comments
 */
export function comment(text: string): MDComment {
  return hasLineEnding(text)
    ? new MarkdownElement('block', 'comment', 'a multi-line comment', [blockCommentNode(text)])
    : new MarkdownElement('inline', 'comment', 'a comment', [inlineCommentNode(text)]);
}

/**
 * Create an HTML comment on one line, `<!-- text -->`, which the page doesn't show.
 *
 * It works anywhere a string can go, or on its own line between paragraphs. Its text can't have a line ending. For
 * text with several lines, use {@link blockComment}.
 *
 * @example
 * md.inlineComment('cspell:ignore gezellig');
 * // <!-- cspell:ignore gezellig -->
 * @category comments
 */
export function inlineComment(text: string): MDInlineComment {
  if (hasLineEnding(text)) throw new TypeError('an inline comment has no line endings; use blockComment');
  return new MarkdownElement('inline', 'inlineComment', 'an inline comment', [inlineCommentNode(text)]);
}

/**
 * Create an HTML comment with its markers on lines of their own, which the page doesn't show.
 *
 * It goes on its own lines, not inside a line, such as in a paragraph or a summary. Its text stays as given, including
 * blank lines. For a comment inside a line, use {@link inlineComment}.
 *
 * @example
 * md.blockComment('cspell:ignore ssjcs\ncspell:words StreetSideSoftware');
 * // <!--
 * // cspell:ignore ssjcs
 * // cspell:words StreetSideSoftware
 * // -->
 * @category comments
 */
export function blockComment(text: string): MDBlockComment {
  return new MarkdownElement('block', 'blockComment', 'a block comment', [blockCommentNode(text)]);
}

function inlineCommentNode(text: string): PhrasingContent {
  return inlineHtmlNode(`<!-- ${commentSafe(text)} -->`);
}

function blockCommentNode(text: string): Html {
  return { type: 'html', value: `<!--\n${commentSafe(text)}\n-->` };
}

function hasLineEnding(text: string): boolean {
  return /[\r\n]/.test(text);
}

/**
 * Return comment text that can't end the comment early.
 * HTML ends a comment at `-->` or `--!>`.
 */
function commentSafe(text: string): string {
  return text.replace(/--(!?)>/g, '-- $1>');
}
