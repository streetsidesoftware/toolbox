import type { Html, Literal, PhrasingContent, RootContent } from 'mdast';

/**
 * Describes HTML inside a line, such as a comment or `<br/>`.
 * It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 * mdast has no such node type, so these nodes are made only here.
 */
export interface InlineHtmlNode extends Literal {
  type: 'inlineHtml';
}

/** Return the node for HTML inside a line. */
export function inlineHtmlNode(value: string): PhrasingContent {
  const node: InlineHtmlNode = { type: 'inlineHtml', value };
  return node as Literal as PhrasingContent;
}

/** Return the node as inline HTML: an `html` node becomes one, and other nodes stay as they are. */
export function asInlineHtml(node: RootContent): PhrasingContent {
  return node.type === 'html' ? inlineHtmlNode((node as Html).value) : (node as PhrasingContent);
}

/** Return the node as an inline HTML node, or `undefined` when it is another node. */
export function asInlineHtmlNode(node: RootContent): InlineHtmlNode | undefined {
  return (node.type as string) === 'inlineHtml' ? (node as Literal as InlineHtmlNode) : undefined;
}
