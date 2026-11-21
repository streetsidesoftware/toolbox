import { detectMarkdownStyle, paragraphContent } from '../core/index.ts';
import type { RootContent } from '../core/index.ts';
import { MarkdownElement } from '../element/index.ts';
import type { MarkdownStyle, MDFragment, MDInlineFragment } from '../types.ts';

/** Return parsed nodes as an element, in the style of the text they were parsed from. */
export function fragment(nodes: RootContent[], markdown: string): MDFragment | MDInlineFragment {
  return fragmentOf(nodes, detectMarkdownStyle(nodes, markdown));
}

/** Return nodes as an element. No nodes or a single paragraph is inline, and anything else is blocks. */
export function fragmentOf(nodes: RootContent[], style: MarkdownStyle | undefined): MDFragment | MDInlineFragment {
  const inline = paragraphContent(nodes);
  if (inline) return new MarkdownElement('inline', 'inlineFragment', 'an inline Markdown fragment', inline, style);
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', nodes, style);
}
