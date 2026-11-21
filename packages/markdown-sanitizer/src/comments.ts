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
 * - Any other `<!…>`, such as a declaration or a CDATA section, a processing instruction, `<?…>`, and a `</` that
 *   no letter follows. A browser reads each as a comment that ends at the next `>`.
 *
 * A comment can sit anywhere inside an HTML node, such as between the tags of a `<div>`, but not inside a tag: a
 * `<!--` in an attribute value is text. An attribute value that its node doesn't close is still searched, so a
 * comment in it is found.
 *
 * A comment that its node doesn't close runs on into the rest of the page, since the browser reads everything after
 * it as comment. It ends at the first `-->` or `--!>` in a later HTML node, or else at the end of the document. Only
 * HTML nodes count, since a `-->` in text or code reaches the browser as `--&gt;`.
 *
 * Each search stops at the end of its node, so the time taken grows with the length of the document.
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
      const start = indexOf(markdown, '<', pos, nodeEnd);
      if (start < 0) break;
      const kind = openingKind(markdown, start);
      if (kind === undefined) {
        pos = start + 1;
        continue;
      }
      if (kind === 'tag') {
        pos = tagEnd(markdown, start, nodeEnd);
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
      const close = indexOf(markdown, '>', start + 2, nodeEnd);
      const end = close >= 0 ? close + 1 : nodeEnd;
      spans.push({ start, end, node });
      pos = end;
    }
  }

  if (open) spans.push({ ...open, end: markdown.length });
  return spans;
}

/**
 * Tell what the `<` at `start` opens, as a browser reads it, or return `undefined` for a `<` that is text. `</>` is
 * `undefined` too: a browser drops it.
 */
function openingKind(markdown: string, start: number): 'comment' | 'bogus' | 'tag' | undefined {
  const next = markdown[start + 1];
  if (next === '!') return markdown.startsWith('--', start + 2) ? 'comment' : 'bogus';
  if (next === '?') return 'bogus';
  if (next === '/') {
    if (isLetter(markdown, start + 2)) return 'tag';
    return markdown[start + 2] === '>' ? undefined : 'bogus';
  }
  return isLetter(markdown, start + 1) ? 'tag' : undefined;
}

/** Return the end of `<!-->` or `<!--->` at `start`, or `undefined` if the comment there isn't one of them. */
function emptyCommentEnd(markdown: string, start: number): number | undefined {
  if (markdown.startsWith('>', start + 4)) return start + 5;
  if (markdown.startsWith('->', start + 4)) return start + 6;
  return undefined;
}

/** Return the end of the first `-->` or `--!>` in `[from, to)`, or `undefined` if there is none. */
function commentEnd(markdown: string, from: number, to: number): number | undefined {
  for (let pos = from; pos + 3 <= to; pos++) {
    if (markdown[pos] !== '-' || markdown[pos + 1] !== '-') continue;
    if (markdown[pos + 2] === '>') return pos + 3;
    if (markdown[pos + 2] === '!' && markdown[pos + 3] === '>' && pos + 4 <= to) return pos + 4;
  }
  return undefined;
}

/**
 * The states of a browser reading a tag, merged where they treat the next character alike. `between` is before an
 * attribute name, after a quoted value, or after a `/`.
 */
type TagState = 'tagName' | 'between' | 'attributeName' | 'afterName' | 'beforeValue' | 'unquoted' | 'quoted';

/**
 * Return the end of the tag that starts at `start`, as a browser reads it, or `to` if it doesn't end before `to`.
 * A quoted attribute value can hold `<` and `>`. When a quoted value doesn't end before `to`, return where the value
 * starts, so the rest is searched for comments.
 */
function tagEnd(markdown: string, start: number, to: number): number {
  let state: TagState = 'tagName';
  let quote = '';
  let valueStart = to;
  for (let pos = start + 1; pos < to; pos++) {
    const char = markdown[pos];
    if (state === 'quoted') {
      if (char === quote) state = 'between';
      continue;
    }
    if (char === '>') return pos + 1;
    const space = isSpace(char);
    switch (state) {
      case 'tagName':
        if (space || char === '/') state = 'between';
        break;
      case 'between':
        if (!space && char !== '/') state = 'attributeName';
        break;
      case 'attributeName':
        if (space) state = 'afterName';
        else if (char === '/') state = 'between';
        else if (char === '=') state = 'beforeValue';
        break;
      case 'afterName':
        if (char === '/') state = 'between';
        else if (char === '=') state = 'beforeValue';
        else if (!space) state = 'attributeName';
        break;
      case 'beforeValue':
        if (char === '"' || char === "'") {
          state = 'quoted';
          quote = char;
          valueStart = pos + 1;
        } else if (!space) state = 'unquoted';
        break;
      case 'unquoted':
        if (space) state = 'between';
        break;
    }
  }
  return state === 'quoted' ? valueStart : to;
}

/** Return the index of the first `char` in `[from, to)`, or -1 if there is none. */
function indexOf(markdown: string, char: string, from: number, to: number): number {
  for (let pos = from; pos < to; pos++) {
    if (markdown[pos] === char) return pos;
  }
  return -1;
}

function isLetter(markdown: string, pos: number): boolean {
  const letter = markdown.charCodeAt(pos) | 0x20;
  return letter >= 0x61 && letter <= 0x7a;
}

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}
