import type { Delete, Emphasis, Html, Nodes, Parent, PhrasingContent, Root, RootContent, Strong, Yaml } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Options as StyleOptions } from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { HtmlEntityNode } from './htmlEntityNode.ts';
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

/** Holds the handlers that write a placeholder, an HTML entity and frontmatter as is. */
// remark-stringify's handler types list only mdast's own node types.
const handlers = {
  placeholder: (node: PlaceholderNode) => node.value,
  htmlEntity: (node: HtmlEntityNode) => node.value,
  yaml: (node: Yaml) => (node.value ? `---\n${node.value}\n---` : '---\n---'),
} as StyleOptions['handlers'];

/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
export function renderNodes(children: RootContent[], style: StyleOptions | undefined): string {
  const root: Root = { type: 'root', children: withoutEmptyParagraphs(structuredClone(children)) };
  visit(root, (node) => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') trimLines(node.children);
    if (node.type === 'tableCell') visit(node, oneLine);
    // Markdown has no empty code: two backticks show as text, and two such pairs turn the text between them into code.
    if (node.type === 'inlineCode' && !node.value) node.value = ' ';
    // Formatting markers with nothing between them show as text, or as a horizontal rule on a line of their own.
    if (isFormatting(node) && !node.children.length) node.children.push({ type: 'text', value: ' ' });
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

function isFormatting(node: Nodes): node is Delete | Emphasis | Strong {
  return node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete';
}

/**
 * Remove the line endings and line breaks at the start and end of a run of lines, in place.
 * Nothing is on their other side, so they can't display. Kept, they would render as `&#xA;` or a literal `\`.
 */
function trimLines(children: PhrasingContent[]): void {
  while (children.length) {
    const first = children[0];
    if (first.type === 'text') first.value = trimLeadingLineEndings(first.value);
    if (first.type !== 'break' && (first.type !== 'text' || first.value)) break;
    children.shift();
  }
  while (children.length) {
    const last = children[children.length - 1];
    if (last.type === 'text') last.value = trimTrailingLineEndings(last.value);
    if (last.type !== 'break' && (last.type !== 'text' || last.value)) break;
    children.pop();
  }
}

/**
 * Keep a table cell on one line, in place: a line break becomes `<br/>`, and a line ending in text or code a space.
 * A Markdown hard break would end the row.
 */
function oneLine(node: Nodes, index: number | undefined, parent: Parent | undefined): void {
  if (node.type === 'break' && parent && index !== undefined) {
    parent.children[index] = { type: 'html', value: '<br/>' } satisfies Html;
  }
  if (node.type === 'text' || node.type === 'inlineCode') {
    node.value = node.value.replace(/\r\n?|\n/g, ' ');
  }
}

/** Return the text without its leading spaces, tabs and line endings, when they include a line ending. */
function trimLeadingLineEndings(text: string): string {
  let i = 0;
  while (isBlank(text[i])) ++i;
  return /[\r\n]/.test(text.slice(0, i)) ? text.slice(i) : text;
}

/** Return the text without its trailing spaces, tabs and line endings, when they include a line ending. */
function trimTrailingLineEndings(text: string): string {
  let i = text.length - 1;
  while (isBlank(text[i])) --i;
  const end = i + 1;
  return /[\r\n]/.test(text.slice(end)) ? text.slice(0, end) : text;
}

function isBlank(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}
