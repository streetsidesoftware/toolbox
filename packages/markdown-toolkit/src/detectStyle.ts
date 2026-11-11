import { detectMarkdownStyle, parseTree } from './core/index.ts';
import type { MarkdownStyle } from './types.ts';

/**
 * Detect how existing Markdown is written, such as its bullet and emphasis markers.
 *
 * Pass the result to {@link MDDocument.withStyle}, so new content matches the file.
 *
 * @example
 * md.document(md.list(['German'])).withStyle(md.detectStyle('* Dutch\n'));
 * // * German
 * @category style
 */
export function detectStyle(markdown: string): MarkdownStyle {
  return detectMarkdownStyle(parseTree(markdown, false), markdown);
}
