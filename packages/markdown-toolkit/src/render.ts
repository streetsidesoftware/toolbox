import type { Html, Nodes, Parent, PhrasingContent, Root, RootContent, Yaml } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Options as StyleOptions } from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { isNewlineBreak } from './newlineBreak.ts';
import { asPlaceholderNode } from './placeholderNode.ts';
import type { PlaceholderNode } from './placeholderNode.ts';

export type { Options as StyleOptions } from 'remark-stringify';

/** The style for constructs an element carries no style for. */
export const defaultStyle: StyleOptions = {
  bullet: '-',
  emphasis: '_',
  fence: '`',
  fences: true,
  incrementListMarker: false,
  rule: '-',
  strong: '*',
};

/** A placeholder and frontmatter are written as is. */
// remark-stringify's handler types list only mdast's own node types.
const handlers = {
  placeholder: (node: PlaceholderNode) => node.value,
  yaml: (node: Yaml) => (node.value ? `---\n${node.value}\n---` : '---\n---'),
} as StyleOptions['handlers'];

/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
export function renderNodes(children: RootContent[], style: StyleOptions | undefined): string {
  const root: Root = { type: 'root', children: structuredClone(children) };
  visit(root, (node) => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      node.children = edgeBreaksOutside(node.children);
      trimLines(node.children);
    }
    if (node.type === 'paragraph') keepPlaceholderLines(node.children);
    if (node.type === 'tableCell') visit(node, oneLine);
    if (node.type === 'heading') visit(node, 'break', htmlBreak);
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
 * The nodes with each line break at the start or end of bold, italic, struck-through or linked text moved out of it.
 * Inside, the break would render as `&#xA;` before the closing `**`.
 */
function edgeBreaksOutside(children: PhrasingContent[]): PhrasingContent[] {
  return children.flatMap((node): PhrasingContent[] => {
    if (node.type !== 'strong' && node.type !== 'emphasis' && node.type !== 'delete' && node.type !== 'link') {
      return [node];
    }
    const inner = edgeBreaksOutside(node.children);
    let start = 0;
    let end = inner.length;
    while (start < end && inner[start].type === 'break') ++start;
    while (end > start && inner[end - 1].type === 'break') --end;
    node.children = inner.slice(start, end);
    return [...inner.slice(0, start), node, ...inner.slice(end)];
  });
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
 * Give a placeholder alone on its line plain line endings, in place, so a later step reading the Markdown can substitute
 * blocks for it. A Markdown hard break would leave a `\` before them. Only a newline from a string counts as a line
 * ending here: a `lineBreak()` stays a hard break.
 */
function keepPlaceholderLines(children: PhrasingContent[]): void {
  children.forEach((node, i) => {
    if (!asPlaceholderNode(node)) return;
    const before = children[i - 1];
    const after = children[i + 1];
    if ((before && !isNewlineBreak(before)) || (after && !isNewlineBreak(after))) return;
    if (before) children[i - 1] = { type: 'text', value: '\n' };
    if (after) children[i + 1] = { type: 'text', value: '\n' };
  });
}

/**
 * Keep a table cell on one line, in place: a line break becomes `<br/>`, and a line ending in text or code a space.
 * A Markdown hard break would end the row.
 */
function oneLine(node: Nodes, index: number | undefined, parent: Parent | undefined): void {
  if (node.type === 'break') htmlBreak(node, index, parent);
  if (node.type === 'text' || node.type === 'inlineCode') {
    node.value = node.value.replace(/\r\n?|\n/g, ' ');
  }
}

/** A line break as `<br/>`, in place. A heading on one line, like `### Title`, would drop a Markdown hard break. */
function htmlBreak(node: Nodes, index: number | undefined, parent: Parent | undefined): void {
  if (node.type === 'break' && parent && index !== undefined) {
    parent.children[index] = { type: 'html', value: '<br/>' } satisfies Html;
  }
}

/** The text without its leading spaces, tabs and line endings, when they include a line ending. */
function trimLeadingLineEndings(text: string): string {
  let i = 0;
  while (isBlank(text[i])) ++i;
  return /[\r\n]/.test(text.slice(0, i)) ? text.slice(i) : text;
}

/** The text without its trailing spaces, tabs and line endings, when they include a line ending. */
function trimTrailingLineEndings(text: string): string {
  let i = text.length - 1;
  while (isBlank(text[i])) --i;
  const end = i + 1;
  return /[\r\n]/.test(text.slice(end)) ? text.slice(0, end) : text;
}

function isBlank(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}
