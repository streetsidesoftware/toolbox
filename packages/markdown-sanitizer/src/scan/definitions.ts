import type { Definition, FootnoteDefinition, Nodes, Root } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

import type { Span } from './spans.ts';

/** The spans of the link definitions and footnotes that the page leaves out. */
export interface UnusedDefinitions {
  definitions: Span[];
  footnotes: Span[];
}

/** The labels that a part of the document refers to. */
interface References {
  links: string[];
  footnotes: string[];
}

interface Footnote {
  node: FootnoteDefinition;
  references: References;
}

/**
 * Find the link definitions and footnotes that nothing on the page uses, so the page shows nothing of them.
 *
 * - The page shows a footnote only when its text cites it, or a footnote the page shows does. A reference inside a
 *   footnote the page leaves out uses nothing.
 * - When two share a label, the first one wins, so a later one is unused even when its label is referenced.
 */
export function findUnusedDefinitions(tree: Root, offset: number): UnusedDefinitions {
  const definitions: Definition[] = [];
  const footnotes: Footnote[] = [];
  const text: References = { links: [], footnotes: [] };
  collect(tree, text, definitions, footnotes);

  const firstFootnotes = new Map<string, Footnote>();
  for (const footnote of footnotes) {
    if (!firstFootnotes.has(footnote.node.identifier)) firstFootnotes.set(footnote.node.identifier, footnote);
  }

  const linked = new Set(text.links);
  const cited = new Set<string>();
  const toCite = [...text.footnotes];
  for (let label = toCite.pop(); label !== undefined; label = toCite.pop()) {
    if (cited.has(label)) continue;
    cited.add(label);
    const references = firstFootnotes.get(label)?.references;
    if (!references) continue;
    for (const link of references.links) linked.add(link);
    for (const footnote of references.footnotes) toCite.push(footnote);
  }

  return {
    definitions: unused(definitions, linked, offset),
    footnotes: unused(
      footnotes.map(({ node }) => node),
      cited,
      offset,
    ),
  };
}

/**
 * Collect the definitions and footnotes under `parent`, in document order, and the labels it refers to. The
 * references inside a footnote go to that footnote, not to `parent`.
 */
function collect(parent: Nodes, references: References, definitions: Definition[], footnotes: Footnote[]): void {
  visit(parent, (node) => {
    if (node === parent) return;
    switch (node.type) {
      case 'definition':
        definitions.push(node);
        return;
      case 'footnoteDefinition': {
        const footnote: Footnote = { node, references: { links: [], footnotes: [] } };
        footnotes.push(footnote);
        collect(node, footnote.references, definitions, footnotes);
        return SKIP;
      }
      case 'linkReference':
      case 'imageReference':
        references.links.push(node.identifier);
        return;
      case 'footnoteReference':
        references.footnotes.push(node.identifier);
        return;
    }
  });
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
