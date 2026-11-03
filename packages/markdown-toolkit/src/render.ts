import type { Html, Link, Nodes, Parent, PhrasingContent, Root, RootContent, Text, Yaml } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Options as StyleOptions } from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { isFormatting, trimAroundLineEndings, trimBlanksAroundBreaks, trimLineEdges } from './blanks.ts';
import type { HtmlEntityNode } from './htmlEntityNode.ts';
import type { InlineHtmlNode } from './inlineHtmlNode.ts';
import type { PlaceholderNode } from './placeholderNode.ts';

export type { Options as StyleOptions } from 'remark-stringify';

/** Holds the style for constructs an element carries no style for. */
export const defaultStyle: StyleOptions = {
  bullet: '-',
  emphasis: '_',
  fence: '`',
  fences: true,
  incrementListMarker: false,
  rule: '-',
  strong: '*',
};

/** Holds the handlers that write a placeholder, an HTML entity, HTML inside a line and frontmatter as is. */
// remark-stringify's handler types list only mdast's own node types.
const handlers = {
  placeholder: (node: PlaceholderNode) => node.value,
  htmlEntity: (node: HtmlEntityNode) => node.value,
  inlineHtml: (node: InlineHtmlNode) => node.value,
  yaml: (node: Yaml) => (node.value ? `---\n${node.value}\n---` : '---\n---'),
} as StyleOptions['handlers'];

/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
export function renderNodes(children: RootContent[], style: StyleOptions | undefined): string {
  const root: Root = { type: 'root', children: structuredClone(children) };
  // Before line breaks in a table cell or heading become `<br/>`.
  visit(root, (node) => {
    // Only text, links, formatting and code sit in the same parent as text or a line break.
    if ('children' in node) {
      const inline = node.children as PhrasingContent[];
      node.children = trimAroundLineEndings(trimBlanksAroundBreaks(inline)) as typeof node.children;
    }
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      node.children = trimLineEdges(node.children);
    }
  });
  // After the trimming, which can leave a paragraph empty.
  root.children = withoutEmptyParagraphs(root.children);
  visit(root, (node) => {
    if (node.type === 'tableCell' || node.type === 'heading') visit(node, oneLine);
    // Markdown has no empty code: two backticks show as text, and two such pairs turn the text between them into code.
    if (node.type === 'inlineCode' && !node.value) node.value = ' ';
    // Formatting markers with nothing between them show as text, or as a horizontal rule on a line of their own.
    if (isFormatting(node) && !node.children.length) node.children.push({ type: 'text', value: ' ' });
    if (node.type === 'link') {
      // remark writes a link as an autolink only when its text is a single text node.
      const text = asAutolinkText(node);
      if (text) node.children = [text];
    }
  });
  // A field set to `undefined` keeps the default, rather than falling back to remark's own default.
  const given = Object.entries(style ?? {}).filter(([, value]) => value !== undefined);
  const md = unified()
    .use(remarkGfm)
    .use(remarkStringify, { ...defaultStyle, ...Object.fromEntries(given), handlers })
    .stringify(root);
  return md.replace(/\n$/, '');
}

/**
 * Return the nodes without paragraphs that have nothing in them, which would only add blank lines.
 * A paragraph that holds only whitespace stays.
 */
function withoutEmptyParagraphs<T extends RootContent>(nodes: readonly T[]): T[] {
  return nodes.flatMap((node): T[] => {
    if (!('children' in node)) return [node];
    const children = withoutEmptyParagraphs<RootContent>(node.children);
    if (!children.length && node.type === 'paragraph') return [];
    return [{ ...node, children } as T];
  });
}

/**
 * Return a link's text as one text node, when the link is an autolink with a placeholder in its text.
 * The checks are the autolink rules remark applies too, so a joined text always renders as `<…>`, where nothing is escaped.
 */
function asAutolinkText(link: Link): Text | undefined {
  const pieces = link.children;
  if (link.title || !pieces.some((piece) => piece.type === 'placeholder')) return undefined;
  if (!pieces.every((piece) => piece.type === 'text' || piece.type === 'placeholder')) return undefined;
  const value = pieces.map((piece) => piece.value).join('');
  if (value !== link.url) return undefined;
  if (!/^[a-z][+\-.a-z]+:/i.test(link.url) || /[\0- <>\x7F]/.test(link.url)) return undefined;
  return { type: 'text', value };
}

/**
 * Keep a table cell or heading on one line, in place: a line break becomes `<br/>`, and a line ending in text or code
 * a space. A Markdown hard break would end the row, or, in a heading, become a space or turn it into an underlined one.
 */
function oneLine(node: Nodes, index: number | undefined, parent: Parent | undefined): void {
  if (node.type === 'break' && parent && index !== undefined) {
    parent.children[index] = { type: 'html', value: '<br/>' } satisfies Html;
  }
  if (node.type === 'text' || node.type === 'inlineCode') {
    node.value = node.value.replace(/\r\n?|\n/g, ' ');
  }
}
