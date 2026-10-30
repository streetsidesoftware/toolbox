import type { Literal, PhrasingContent, RootContent } from 'mdast';

/**
 * An HTML character reference, such as `&nbsp;`. It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 * mdast has no such node type, so these nodes are made only here.
 */
export interface HtmlEntityNode extends Literal {
  type: 'htmlEntity';
}

/** The node for a reference such as `&nbsp;`. */
export function htmlEntityNode(reference: string): PhrasingContent {
  const node: HtmlEntityNode = { type: 'htmlEntity', value: reference };
  return node as Literal as PhrasingContent;
}

/** The node as an HTML entity node, or `undefined` when it is another node. */
export function asHtmlEntityNode(node: RootContent): HtmlEntityNode | undefined {
  return (node.type as string) === 'htmlEntity' ? (node as Literal as HtmlEntityNode) : undefined;
}
