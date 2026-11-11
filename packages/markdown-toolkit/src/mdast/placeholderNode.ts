import type { Literal, PhrasingContent } from 'mdast';

/**
 * A placeholder kept as written. It has a node type of its own, so rendering writes it as is.
 * It isn't an `html` node because remark-stringify turns a line ending before one into a space.
 * `customNodes.ts` adds it to mdast's content types, for this package's own code only.
 */
export interface PlaceholderNode extends Literal {
  type: 'placeholder';
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
