import type { Html, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { CommentSpan } from './comments.ts';
import { findComments } from './comments.ts';
import { findUnusedDefinitions } from './definitions.ts';
import { findInvisibleCharacters, findInvisibleReferences } from './invisible.ts';
import type { Span } from './span.ts';
import type { HiddenKind } from './types.ts';

/**
 * Where hidden text sits, which decides how it can be shown:
 * - `inline`: inside a line of text.
 * - `block`: in lines of its own. `anchor` is where its block starts, after any quote or list markers. Text comes
 *   before it on its first line when `anchor` is before `start`.
 * - `html`: inside other HTML, such as between the tags of a `<div>`, where Markdown doesn't work.
 */
export type Placement = 'inline' | 'block' | 'html';

/** A piece of hidden text and where it sits. */
export interface Found extends Span {
  kind: HiddenKind;
  placement: Placement;
  anchor: number;
}

/** The parents an HTML node has when it's a block of its own, not part of a line. */
const blockParents = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition']);

/** Find the hidden text in Markdown, in order and without overlaps. */
export function scanHidden(markdown: string): Found[] {
  const offset = markdown.startsWith('\uFEFF') ? 1 : 0;
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown.slice(offset));
  const { html, inline, code } = collectNodes(tree);

  const comments = findComments(markdown, html, offset).map((span) => placeComment(span, inline, offset));
  const { definitions, footnotes } = findUnusedDefinitions(tree, offset);
  const blocks = merged([...comments, ...asBlocks(definitions, 'definition'), ...asBlocks(footnotes, 'footnote')]);

  const characters = findInvisibleCharacters(markdown, blocks);
  const references = findInvisibleReferences(markdown, merged([...blocks, ...shifted(code, offset)]));
  const invisible = joinTouching([...characters, ...references].sort(byStart)).map(({ start, end }): Found => ({
    kind: 'invisible',
    start,
    end,
    placement: 'inline',
    anchor: start,
  }));

  return [...blocks, ...invisible].sort(byStart);
}

interface Nodes {
  /** The HTML nodes, in document order. */
  html: Html[];
  /** The HTML nodes that are part of a line. */
  inline: Set<Html>;
  /** Code, where a character reference is text, with offsets in the parsed text. */
  code: Span[];
}

function collectNodes(tree: Root): Nodes {
  const nodes: Nodes = { html: [], inline: new Set(), code: [] };
  visit(tree, (node, _index, parent) => {
    if (node.type === 'html') {
      nodes.html.push(node);
      if (parent && !blockParents.has(parent.type)) nodes.inline.add(node);
    }
    if (node.type === 'code' || node.type === 'inlineCode') {
      nodes.code.push({ start: node.position?.start.offset ?? 0, end: node.position?.end.offset ?? 0 });
    }
  });
  return nodes;
}

/**
 * Tell where a comment sits. A comment inside other HTML that runs past its node's end can't be shown as HTML code,
 * since a blank line would turn the rest into Markdown, so it's shown as a block after the HTML before it.
 */
function placeComment({ start, end, node }: CommentSpan, inline: Set<Html>, offset: number): Found {
  const nodeStart = (node.position?.start.offset ?? 0) + offset;
  const nodeEnd = (node.position?.end.offset ?? 0) + offset;
  const found = { kind: 'comment' as const, start, end, anchor: nodeStart };
  if (inline.has(node)) return { ...found, placement: 'inline' };
  if (start > nodeStart && end <= nodeEnd) return { ...found, placement: 'html' };
  return { ...found, placement: 'block' };
}

function asBlocks(spans: Span[], kind: HiddenKind): Found[] {
  return spans.map(({ start, end }) => ({ kind, start, end, placement: 'block', anchor: start }));
}

function shifted(spans: Span[], offset: number): Span[] {
  return spans.map(({ start, end }) => ({ start: start + offset, end: end + offset }));
}

/**
 * Sort spans and merge each one that overlaps an earlier one into it, keeping the earlier one's other fields.
 * A comment left open inside a footnote runs past the footnote's end, so spans can overlap without nesting.
 */
function merged<T extends Span>(spans: T[]): T[] {
  const kept: T[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = kept.at(-1);
    if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
    else kept.push({ ...span });
  }
  return kept;
}

/** Join sorted spans where one ends right where the next starts. */
function joinTouching(spans: Span[]): Span[] {
  const joined: Span[] = [];
  for (const { start, end } of spans) {
    const last = joined.at(-1);
    if (last && last.end === start) last.end = end;
    else joined.push({ start, end });
  }
  return joined;
}

function byStart(a: Span, b: Span): number {
  return a.start - b.start;
}
