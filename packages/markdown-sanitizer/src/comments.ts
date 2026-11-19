import type { Html } from 'mdast';

import type { Span } from './span.ts';

/** A comment, with the HTML node it opens in. */
export interface CommentSpan extends Span {
  node: Html;
}

/**
 * Find the comments in the raw HTML of a document, as spans of the source.
 *
 * The page hides each of these:
 * - A comment, `<!-- … -->`. It ends at the first `-->` or `--!>`, as a browser ends it. `<!-->` and `<!--->` are
 *   empty comments.
 * - A processing instruction, `<?…>`, a declaration, `<!…>`, or a CDATA section, `<![CDATA[…]]>`. A browser reads
 *   each as a comment that ends at the next `>`.
 *
 * A comment can sit anywhere inside an HTML node, such as between the tags of a `<div>`.
 *
 * A comment that its node doesn't close runs on into the rest of the page, since the browser reads everything after
 * it as comment. It ends at the first `-->` or `--!>` in a later HTML node, or else at the end of the document. Only
 * HTML nodes count, since a `-->` in text or code reaches the browser as `--&gt;`.
 *
 * @param htmlNodes - in document order.
 */
export function findComments(markdown: string, htmlNodes: Html[], offset: number): CommentSpan[] {
  const spans: CommentSpan[] = [];
  let open: { start: number; node: Html } | undefined;

  for (const node of htmlNodes) {
    let pos = (node.position?.start.offset ?? 0) + offset;
    const nodeEnd = (node.position?.end.offset ?? 0) + offset;

    if (open) {
      const end = commentEnd(markdown, pos, nodeEnd);
      if (end === undefined) continue;
      spans.push({ ...open, end });
      open = undefined;
      pos = end;
    }

    while (pos < nodeEnd) {
      const start = markdown.indexOf('<', pos);
      if (start < 0 || start >= nodeEnd) break;
      const kind = openingKind(markdown, start);
      if (kind === undefined) {
        pos = start + 1;
        continue;
      }
      if (kind === 'comment') {
        const end = emptyCommentEnd(markdown, start) ?? commentEnd(markdown, start + 4, nodeEnd);
        if (end === undefined) {
          open = { start, node };
          break;
        }
        spans.push({ start, end, node });
        pos = end;
        continue;
      }
      const close = markdown.indexOf('>', start + 2);
      const end = close >= 0 && close < nodeEnd ? close + 1 : nodeEnd;
      spans.push({ start, end, node });
      pos = end;
    }
  }

  if (open) spans.push({ ...open, end: markdown.length });
  return spans;
}

/** Tell what the `<` at `start` opens, or return `undefined` for a tag or a stray `<`. */
function openingKind(markdown: string, start: number): 'comment' | 'bogus' | undefined {
  if (markdown.startsWith('<!--', start)) return 'comment';
  const next = markdown[start + 1];
  if (next === '?') return 'bogus';
  if (next !== '!') return undefined;
  if (markdown.startsWith('[CDATA[', start + 2)) return 'bogus';
  const letter = markdown.charCodeAt(start + 2) | 0x20;
  return letter >= 0x61 && letter <= 0x7a ? 'bogus' : undefined;
}

/** Return the end of `<!-->` or `<!--->` at `start`, or `undefined` if the comment there isn't one of them. */
function emptyCommentEnd(markdown: string, start: number): number | undefined {
  if (markdown.startsWith('>', start + 4)) return start + 5;
  if (markdown.startsWith('->', start + 4)) return start + 6;
  return undefined;
}

/** Return the end of the first `-->` or `--!>` in `[from, to)`, or `undefined` if there is none. */
function commentEnd(markdown: string, from: number, to: number): number | undefined {
  let pos = from;
  while (pos < to) {
    const dashes = markdown.indexOf('--', pos);
    if (dashes < 0 || dashes >= to) return undefined;
    if (markdown.startsWith('>', dashes + 2) && dashes + 3 <= to) return dashes + 3;
    if (markdown.startsWith('!>', dashes + 2) && dashes + 4 <= to) return dashes + 4;
    pos = dashes + 1;
  }
  return undefined;
}
