import { DocumentElement, readFrontmatter, yamlNode } from '../builder/index.ts';
import { detectMarkdownStyle, parseTree } from '../core/index.ts';
import type { MDDocument, MDFragment, MDInlineFragment } from '../types.ts';
import { fragment } from './fragment.ts';
import type { TemplateResolver } from './replacements.ts';
import { substituteInTree } from './substitute.ts';

/**
 * Parse Markdown text so it can be added to a page with its formatting.
 *
 * Placeholders such as `{​@ name @​}` and HTML entities such as `&nbsp;` are preserved.
 *
 * One paragraph or blank text gives an {@link MDInlineFragment}, and anything else an {@link MDFragment}.
 *
 * For a whole file with frontmatter, use {@link parseDocument}.
 *
 * @example
 * md.parse('Some **bold** text.');
 * // The page shows "Some bold text." with "bold" in bold.
 * @category text
 */
export function parse(markdown: string): MDFragment | MDInlineFragment {
  return fragment(parseTree(markdown, false), markdown);
}

/**
 * Parse a whole Markdown file, frontmatter included.
 *
 * Its frontmatter, formatting and `{​@ name @​}` placeholders stay as they are, ready for {@link substitutePlaceholders}.
 * An HTML entity in the text, such as `&nbsp;`, stays an entity too.
 *
 * @example
 * md.parseDocument('# Title\n\n* item\n');
 * // # Title
 * //
 * // * item
 * @category documents
 */
export function parseDocument(markdown: string): MDDocument {
  return documentOf(markdown);
}

/** Read a whole file as a document, with replacements substituted when there are any. */
export function documentOf(markdown: string, resolve?: TemplateResolver): MDDocument {
  const front = readFrontmatter(markdown);
  const body = front ? markdown.slice(front.end) : markdown;
  const root = parseTree(body, false);
  const style = detectMarkdownStyle(root, body);
  if (front) root.children.unshift(yamlNode(front.yaml));
  if (resolve) substituteInTree(root, resolve, true);
  return new DocumentElement(root.children, style);
}
