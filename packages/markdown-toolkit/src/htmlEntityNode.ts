import type { Literal, PhrasingContent } from 'mdast';

/**
 * An HTML character reference, such as `&nbsp;`. It has a node type of its own, so rendering writes it as is.
 * As HTML, a line ending before it would render as a space.
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
