import type { Literal, PhrasingContent } from 'mdast';

/**
 * A placeholder kept as written. It has a node type of its own, so rendering writes it as is.
 * As HTML, a line ending before it would render as a space.
 * Only this package's own code sees it in mdast's content types; the published types leave mdast unchanged.
 */
export interface PlaceholderNode extends Literal {
  type: 'placeholder';
}

// mdast builds `RootContent` from its own map, so the node goes in both.
declare module 'mdast' {
  interface PhrasingContentMap {
    placeholder: PlaceholderNode;
  }
  interface RootContentMap {
    placeholder: PlaceholderNode;
  }
}

/** Return the node for the placeholder `name`. */
export function placeholderNode(name: string): PhrasingContent {
  return placeholderNodeAsWritten(`{@ ${name} @}`);
}

/** Return the node for a placeholder kept exactly as written, spacing included. */
export function placeholderNodeAsWritten(written: string): PhrasingContent {
  const node: PlaceholderNode = { type: 'placeholder', value: written };
  return node;
}
