import type { Literal, PhrasingContent } from 'mdast';

/**
 * An HTML character reference, such as `&nbsp;`. It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 */
export interface HtmlEntityNode extends Literal {
  type: 'htmlEntity';
}

/** Return the node for a reference such as `&nbsp;`. */
export function htmlEntityNode(reference: string): PhrasingContent {
  const node: HtmlEntityNode = { type: 'htmlEntity', value: reference };
  return node;
}
