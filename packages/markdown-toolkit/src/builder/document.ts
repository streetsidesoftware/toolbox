import type { RootContent } from 'mdast';

import { argumentNodes, MarkdownElement, renderingOf } from '../element/index.ts';
import type { AnyContent, MarkdownStyle, MDDocument, MDFrontmatter } from '../types.ts';
import { frontmatter, isFrontmatter } from './frontmatter.ts';

/**
 * Create a whole Markdown file from its parts, in order.
 *
 * Frontmatter, if any, goes first. Frontmatter after other content, such as a parsed document's, is left out.
 *
 * Each other part goes on a line of its own:
 * - Text, links and other pieces in a row form one paragraph. The page shows a space between them.
 * - A part that shows nothing ends the paragraph.
 * - A paragraph, list or other block goes on its own lines.
 * - An array is one part, and its pieces join with no spaces added. For a sentence built from pieces, use an array or
 *   {@link p}.
 *
 * @example
 * md.document(md.heading(1, 'Title'), md.p('Body.'));
 * // # Title
 * //
 * // Body.
 * @category documents
 */
export function document(frontmatter: MDFrontmatter, ...content: AnyContent[]): MDDocument;

export function document(...content: AnyContent[]): MDDocument;

export function document(...content: (MDFrontmatter | AnyContent)[]): MDDocument {
  const [first, ...rest] = content;
  if (!isFrontmatter(first)) return new DocumentElement(argumentNodes(content as AnyContent[], 'document content'));
  return new DocumentElement([
    ...(renderingOf(first)?.nodes ?? []),
    ...argumentNodes(rest as AnyContent[], 'document content'),
  ]);
}

/** Implements a whole document. It renders with a trailing newline, since it stands alone as a file. */
export class DocumentElement extends MarkdownElement<'block', 'document'> implements MDDocument {
  constructor(nodes: RootContent[], style?: MarkdownStyle) {
    super('block', 'document', 'a document', nodes, style);
  }

  get frontmatter(): string | undefined {
    const [first] = renderingOf(this)?.nodes ?? [];
    return first?.type === 'yaml' ? first.value : undefined;
  }

  withFrontmatter(given: string | MDFrontmatter | undefined): MDDocument {
    const { nodes, style } = renderingOf(this) ?? { nodes: [] };
    const content = nodes[0]?.type === 'yaml' ? nodes.slice(1) : nodes;
    if (given === undefined) return new DocumentElement(content, style);
    const element = typeof given === 'string' ? frontmatter(given) : given;
    return new DocumentElement([...(renderingOf(element)?.nodes ?? []), ...content], style);
  }

  withStyle(style: MarkdownStyle): MDDocument {
    return new DocumentElement(renderingOf(this)?.nodes ?? [], style);
  }

  override toString(): string {
    return super.toString() + '\n';
  }
}
