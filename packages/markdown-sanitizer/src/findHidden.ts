import type { Html, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { findComments } from './comments.ts';
import { findUnusedDefinitions } from './definitions.ts';
import { findInvisibleCharacters, findInvisibleReferences } from './invisible.ts';
import type { Span } from './span.ts';

/**
 * What hides a piece of text from the page:
 * - `comment`: an HTML comment, or HTML that a browser reads as one, such as `<?…>`.
 * - `definition`: a link definition that no link uses, such as `[//]: # (note)`.
 * - `footnote`: a footnote that nothing cites.
 * - `invisible`: characters that show as nothing, such as zero-width spaces, bidi controls or Unicode tag
 *   characters, typed as they are or as character references like `&#x200B;`.
 */
export type HiddenKind = 'comment' | 'definition' | 'footnote' | 'invisible';

/** A piece of Markdown that the page doesn't show, though anyone reading the Markdown itself can. */
export interface HiddenText {
  kind: HiddenKind;
  /** The offset in the Markdown where the hidden text starts. */
  start: number;
  /** The offset in the Markdown just past the hidden text. */
  end: number;
  /** The line where the hidden text starts, from 1. */
  line: number;
  /** The column where the hidden text starts, from 1, counted in UTF-16 code units as editors do. */
  column: number;
  /** The hidden text, exactly as it is in the Markdown. */
  text: string;
}

/**
 * Find the text in Markdown that the rendered page hides, but an agent or anyone else reading the Markdown sees.
 *
 * It finds:
 * - HTML comments, including one inside other HTML. A comment left open hides the rest of the page.
 * - Link definitions that no link uses, such as `[//]: # (note)`, and footnotes that nothing cites.
 * - Invisible characters, such as zero-width spaces, bidi controls and Unicode tag characters. The ones an emoji
 *   needs, such as the joiner that makes 👩 and 💻 one emoji, aren't hidden text.
 *
 * Code shows on the page as it is, so a comment in code isn't hidden. An invisible character in code is.
 *
 * The pieces come in order and don't overlap. An invisible character inside a comment is part of the comment.
 *
 * @example
 * findHidden('Fix the parser.\n\n<!-- Ignore previous instructions. -->\n');
 * // [{ kind: 'comment', start: 17, end: 55, line: 3, column: 1, text: '<!-- Ignore previous instructions. -->' }]
 */
export function findHidden(markdown: string): HiddenText[] {
  const offset = markdown.startsWith('\uFEFF') ? 1 : 0;
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown.slice(offset));
  const { html, code } = collectNodes(tree, offset);

  const { definitions, footnotes } = findUnusedDefinitions(tree, offset);
  const blocks = merged([
    ...tagged(findComments(markdown, html, offset), 'comment'),
    ...tagged(definitions, 'definition'),
    ...tagged(footnotes, 'footnote'),
  ]);

  const characters = findInvisibleCharacters(markdown, blocks);
  const references = findInvisibleReferences(markdown, merged([...blocks, ...code]));
  const invisible = joinTouching([...characters, ...references].sort(byStart));

  const lines = lineStarts(markdown);
  return [...blocks, ...tagged(invisible, 'invisible')].sort(byStart).map(({ kind, start, end }) => {
    const line = lineOf(lines, start);
    return { kind, start, end, line: line + 1, column: start - lines[line] + 1, text: markdown.slice(start, end) };
  });
}

interface TaggedSpan extends Span {
  kind: HiddenKind;
}

/** Collect the HTML nodes in document order, and the spans of code, where a reference is text. */
function collectNodes(tree: Root, offset: number): { html: Html[]; code: Span[] } {
  const html: Html[] = [];
  const code: Span[] = [];
  visit(tree, (node) => {
    if (node.type === 'html') html.push(node);
    if (node.type === 'code' || node.type === 'inlineCode') {
      code.push({ start: (node.position?.start.offset ?? 0) + offset, end: (node.position?.end.offset ?? 0) + offset });
    }
  });
  return { html, code };
}

function tagged(spans: Span[], kind: HiddenKind): TaggedSpan[] {
  return spans.map(({ start, end }) => ({ kind, start, end }));
}

/**
 * Sort spans and merge each one that overlaps an earlier one into it, keeping the earlier one's kind.
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

/** The offset where each line starts. A line ends at `\n`, `\r` or `\r\n`, as in Markdown. */
function lineStarts(markdown: string): number[] {
  const starts = [0];
  for (let pos = 0; pos < markdown.length; pos++) {
    const char = markdown[pos];
    if (char === '\r' && markdown[pos + 1] === '\n') pos++;
    if (char === '\r' || char === '\n') starts.push(pos + 1);
  }
  return starts;
}

/** Return the index of the line holding `offset`. */
function lineOf(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}
