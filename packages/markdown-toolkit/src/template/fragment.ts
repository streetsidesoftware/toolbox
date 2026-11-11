import type { Root } from 'mdast';

import { detectMarkdownStyle } from '../core/index.ts';
import { MarkdownElement } from '../element/index.ts';
import type { MarkdownStyle, MDFragment, MDInlineFragment } from '../types.ts';

/** Return a parsed tree as an element, in the style of its text. */
export function fragment(root: Root, markdown: string): MDFragment | MDInlineFragment {
  return fragmentOf(root, detectMarkdownStyle(root, markdown));
}

/** Return a tree as an element. An empty tree or a single paragraph is inline, and anything else is blocks. */
export function fragmentOf(root: Root, style: MarkdownStyle | undefined): MDFragment | MDInlineFragment {
  const [only, ...rest] = root.children;
  if (!only || (only.type === 'paragraph' && !rest.length)) {
    return new MarkdownElement('inline', 'inlineFragment', 'an inline Markdown fragment', only?.children ?? [], style);
  }
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', root.children, style);
}
