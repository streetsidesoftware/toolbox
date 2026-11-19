import type { Definition, FootnoteDefinition, Root } from 'mdast';
import { visit } from 'unist-util-visit';

import type { Span } from './span.ts';

/** The spans of the link definitions and footnotes that the page leaves out. */
export interface UnusedDefinitions {
  definitions: Span[];
  footnotes: Span[];
}

/**
 * Find the link definitions and footnotes that nothing on the page uses, so the page shows nothing of them.
 *
 * When two share a label, the first one wins, so a later one is unused even when its label is referenced.
 */
export function findUnusedDefinitions(tree: Root, offset: number): UnusedDefinitions {
  const definitions: Definition[] = [];
  const footnotes: FootnoteDefinition[] = [];
  const linked = new Set<string>();
  const cited = new Set<string>();

  visit(tree, (node) => {
    switch (node.type) {
      case 'definition':
        definitions.push(node);
        break;
      case 'footnoteDefinition':
        footnotes.push(node);
        break;
      case 'linkReference':
      case 'imageReference':
        linked.add(node.identifier);
        break;
      case 'footnoteReference':
        cited.add(node.identifier);
        break;
    }
  });

  return {
    definitions: unused(definitions, linked, offset),
    footnotes: unused(footnotes, cited, offset),
  };
}

function unused(nodes: (Definition | FootnoteDefinition)[], used: Set<string>, offset: number): Span[] {
  const seen = new Set<string>();
  const spans: Span[] = [];
  for (const node of nodes) {
    const first = !seen.has(node.identifier);
    seen.add(node.identifier);
    if (first && used.has(node.identifier)) continue;
    spans.push({ start: (node.position?.start.offset ?? 0) + offset, end: (node.position?.end.offset ?? 0) + offset });
  }
  return spans;
}
