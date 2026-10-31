import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { detectMarkdownStyle } from './detectStyle.ts';
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
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  return detectMarkdownStyle(root, markdown);
}
