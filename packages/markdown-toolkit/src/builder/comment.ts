import { MarkdownElement } from '../element/index.ts';
import type { MDComment } from '../types.ts';

/**
 * Return comment text that can't end the comment early.
 * HTML ends a comment at `-->` or `--!>`.
 */
function commentSafe(text: string): string {
  return text.replace(/--(!?)>/g, '-- $1>');
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
