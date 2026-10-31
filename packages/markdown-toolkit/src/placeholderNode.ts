import type { Literal, PhrasingContent, RootContent } from 'mdast';

/**
 * Describes a placeholder kept as written. It has a node type of its own, so rendering writes it as is.
 * As HTML, a line ending before it would render as a space.
 * mdast has no such node type, so placeholder nodes are made and recognized only here.
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
  return node as Literal as PhrasingContent;
}

/** Return the node as a placeholder node, or `undefined` when it's another node. */
export function asPlaceholderNode(node: RootContent): PlaceholderNode | undefined {
  return (node.type as string) === 'placeholder' ? (node as Literal as PlaceholderNode) : undefined;
}
