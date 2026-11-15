import type { Html, Literal, PhrasingContent, RootContent } from 'mdast';

/**
 * HTML inside a line, such as a comment or `<br/>`.
 * It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 */
export interface InlineHtmlNode extends Literal {
  type: 'inlineHtml';
}

/** Return the node for HTML inside a line. */
export function inlineHtmlNode(value: string): PhrasingContent {
  const node: InlineHtmlNode = { type: 'inlineHtml', value };
  return node;
}

/** Return the node as inline HTML: an `html` node becomes one, and other nodes stay as they are. */
export function asInlineHtml(node: RootContent): PhrasingContent {
  return node.type === 'html' ? inlineHtmlNode((node as Html).value) : (node as PhrasingContent);
}
