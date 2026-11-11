import { inlineNodes, MarkdownElement } from '../element/index.ts';
import { linkNode } from '../mdast/index.ts';
import type { InlineContent, MDLink } from '../types.ts';

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
  return new MarkdownElement('inline', 'link', 'a link', [linkNode(href, inlineNodes(content, 'link content'))]);
}
