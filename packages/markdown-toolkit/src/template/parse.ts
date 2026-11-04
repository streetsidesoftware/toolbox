import { listPlaceholders } from '@streetsidesoftware/placeholders';
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Processor } from 'unified';

import { DocumentElement, readFrontmatter, yamlNode } from '../builder/index.ts';
import { detectMarkdownStyle } from '../detectStyle.ts';
import { textNodes } from '../element/index.ts';
import { htmlEntityFromMarkdown, placeholderNodeAsWritten } from '../mdast/index.ts';
import type { MDDocument, MDFragment, MDInlineFragment } from '../types.ts';
import { fragment } from './fragment.ts';
import { substituteInTree } from './substitute.ts';
import type { TemplateResolver } from './values.ts';

/**
 * Parse Markdown text so it can be added to a page with its formatting.
 *
 * Text of one paragraph, or blank text, can go anywhere a string can, even in a heading.
 * Longer text goes where paragraphs can, such as in a document or a list item.
 *
 * An HTML entity in the text, such as `&nbsp;`, stays an entity in the Markdown, so a character that's hard to see
 * stays visible in the file.
 *
 * @example
 * md.parse('Some **bold** text.');
 * // The page shows "Some bold text." with "bold" in bold.
 * @category text
 */
export function parse(markdown: string): MDFragment | MDInlineFragment {
  const root = parseTree(markdown, false);
  keepPlaceholders(root);
  return fragment(root, markdown);
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
  return documentOf(markdown, (body) => {
    const root = parseTree(body, false);
    keepPlaceholders(root);
    return root;
  });
}

/** Read a whole file as a document, its body by `read`, with values substituted when there are any. */
export function documentOf(markdown: string, read: (body: string) => Root, resolve?: TemplateResolver): MDDocument {
  const front = readFrontmatter(markdown);
  const body = front ? markdown.slice(front.end) : markdown;
  const root = read(body);
  const style = detectMarkdownStyle(root, body);
  if (front) root.children.unshift(yamlNode(front.yaml));
  if (resolve) substituteInTree(root, resolve, true);
  return new DocumentElement(root.children, style);
}

/** Make the placeholders in text raw, in place, so rendering can't escape them. */
function keepPlaceholders(parent: Parent): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === 'text') return textNodes(child.value);
    if ('children' in child) keepPlaceholders(child);
    return [child];
  });
}

/** Parse a template into a tree, with each placeholder in its text as a node of its own. */
export function templateTree(markdown: string, inline: boolean): Root {
  const root = parseTree(markdown, inline);
  splitPlaceholders(root);
  return root;
}

/** Make the placeholders in text nodes of their own, in place. */
function splitPlaceholders(parent: Parent): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === 'text') return placeholderPieces(child.value);
    if ('children' in child) splitPlaceholders(child);
    return [child];
  });
}

function placeholderPieces(text: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
  let last = 0;
  for (const { start, end } of listPlaceholders(text)) {
    if (start > last) nodes.push({ type: 'text', value: text.slice(last, start) });
    nodes.push(placeholderNodeAsWritten(text.slice(start, end)));
    last = end;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

/**
 * The block constructs turned off when parsing an inline template.
 * The names are micromark's construct names.
 */
const blockConstructs = [
  'blockQuote',
  'codeFenced',
  'codeIndented',
  'definition',
  'gfmFootnoteDefinition',
  'headingAtx',
  'htmlFlow',
  'list',
  'setextUnderline',
  'table',
  'thematicBreak',
];

function parseTree(markdown: string, inline: boolean): Root {
  const processor = unified().use(remarkParse).use(remarkGfm).use(readEntities);
  if (inline) {
    processor.use(function disableBlocks() {
      const data = this.data();
      (data.micromarkExtensions ??= []).push({ disable: { null: blockConstructs } });
    });
  }
  return processor.parse(markdown);
}

function readEntities(this: Processor): void {
  (this.data().fromMarkdownExtensions ??= []).push(htmlEntityFromMarkdown);
}
