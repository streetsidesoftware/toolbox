import type { Literal, PhrasingContent } from 'mdast';

/**
 * Describes an HTML character reference, such as `&nbsp;`. It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 * Only this package's own code sees it in mdast's content types; the published types leave mdast unchanged.
 */
export interface HtmlEntityNode extends Literal {
  type: 'htmlEntity';
}

// mdast builds `RootContent` from its own map, so the node goes in both.
declare module 'mdast' {
  interface PhrasingContentMap {
    htmlEntity: HtmlEntityNode;
  }
  interface RootContentMap {
    htmlEntity: HtmlEntityNode;
  }
}

/** Return the node for a reference such as `&nbsp;`. */
export function htmlEntityNode(reference: string): PhrasingContent {
  const node: HtmlEntityNode = { type: 'htmlEntity', value: reference };
  return node;
}
