import { replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { PlaceholderResolver } from '@streetsidesoftware/placeholders';
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

import type { MdastRoot } from './types.ts';

/**
 * Replace placeholders in a single string.
 * An unresolved name is left untouched and reported via `onUnresolved`, once per occurrence.
 * The caller is responsible for deduping.
 */
export function substituteInString(
  text: string,
  resolve: PlaceholderResolver,
  onUnresolved: (name: string) => void,
): string {
  return replacePlaceholders(text, (name: string) => {
    const value = resolve(name);
    if (value === undefined) onUnresolved(name);
    return value;
  });
}

/** Text-bearing mdast node types eligible for substitution. */
const textBearingTypes = ['text', 'inlineCode', 'code', 'html'] as const;

/**
 * Walk a markdown subtree's text-bearing nodes and substitute placeholders within each node's
 * own string value, in place.
 * It does not stringify and re-parse the tree, so only the substituted text changes.
 */
export function substituteInTree(
  tree: MdastRoot,
  resolve: PlaceholderResolver,
  onUnresolved: (name: string) => void,
): void {
  visit(tree as Root, [...textBearingTypes], (node) => {
    node.value = substituteInString(node.value, resolve, onUnresolved);
  });
}
