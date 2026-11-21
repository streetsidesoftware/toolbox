import type { Found } from '../scan/index.ts';
import { findInvisibleCharacters } from '../scan/index.ts';

/** What revealed code looks like in a document, so it fits the text around it. */
export interface RevealStyle {
  /** The backticks of a code span: a run no other run in the document matches, so no other run pairs with it. */
  ticks: string;
  /** The document's line ending, for the lines a code block adds. */
  lineEnding: string;
}

export function revealStyle(markdown: string): RevealStyle {
  return {
    ticks: '`'.repeat(unusedRunLength(markdown, '`')),
    lineEnding: /\r\n|\r|\n/.exec(markdown)?.[0] ?? '\n',
  };
}

/**
 * Show a piece of hidden text as code, with its tag characters and variation selectors as escapes.
 *
 * A code span gets a space before it after a backtick or a backslash, and after it before a backtick, so it doesn't
 * join or escape a backtick next to it.
 */
export function reveal(markdown: string, found: Found, previous: string, style: RevealStyle): string {
  const text = escapeInvisible(markdown.slice(found.start, found.end));
  switch (found.placement) {
    case 'literal':
      return text.replaceAll('&', '&amp;');
    case 'inline': {
      const before = previous === '`' || previous === '\\' ? ' ' : '';
      const after = markdown[found.end] === '`' ? ' ' : '';
      return before + style.ticks + text + style.ticks + after;
    }
    case 'html':
      return `<code>${escapeHtml(text)}</code>`;
    case 'block':
      return codeBlock(markdown, found, text, style.lineEnding);
  }
}

/**
 * Replace each tag character and variation selector with an escape, such as `\u{E0041}`, so a model reading the
 * revealed text doesn't read what they spell. Character references stay as they are: they show as text in code.
 */
function escapeInvisible(text: string): string {
  const parts: string[] = [];
  let pos = 0;
  for (const { start, end } of findInvisibleCharacters(text, [])) {
    parts.push(text.slice(pos, start));
    for (const char of text.slice(start, end)) parts.push(escape(char));
    pos = end;
  }
  parts.push(text.slice(pos));
  return parts.join('');
}

function escape(char: string): string {
  return `\\u{${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}}`;
}

/**
 * Show hidden text as a code block in the same quote or list item as the block it starts in.
 *
 * Each of its lines gets the quote and list indentation of that block, so a comment left open that ran out of the
 * quote ends up inside it. Its own lines keep their quote markers, which then show in the code as an agent reads them.
 * They keep their line endings too, and the lines the block adds end with `lineEnding`.
 */
function codeBlock(markdown: string, found: Found, text: string, lineEnding: string): string {
  const lineStart = startOfLine(markdown, found.anchor);
  const indent = continuation(markdown.slice(lineStart, found.anchor));
  const fence = '`'.repeat(Math.max(3, longestRun(text, '`') + 1));
  const lines = text
    .split(/(\r\n|\r|\n)/)
    .map((part, index) => (index % 2 === 0 ? indent + part : part))
    .join('');
  const before = found.anchor < found.start ? `${lineEnding}${indent.trimEnd()}${lineEnding}${indent}` : '';
  const after = isLineEnd(markdown, found.end) ? '' : `${lineEnding}${indent}`;
  return `${before}${fence}${lineEnding}${lines}${lineEnding}${indent}${fence}${after}`;
}

/** Turn the quote and list markers before a block into the indentation its next lines need: list markers become spaces. */
function continuation(prefix: string): string {
  let indent = '';
  for (const char of prefix) indent += char === '>' || char === ' ' || char === '\t' ? char : ' ';
  return indent;
}

function startOfLine(markdown: string, pos: number): number {
  let start = pos;
  while (start > 0 && markdown[start - 1] !== '\n' && markdown[start - 1] !== '\r') start--;
  return start;
}

function isLineEnd(markdown: string, pos: number): boolean {
  return pos >= markdown.length || markdown[pos] === '\n' || markdown[pos] === '\r';
}

/** Return the shortest length that no run of `char` in `text` has. */
function unusedRunLength(text: string, char: string): number {
  const lengths = new Set<number>();
  let run = 0;
  for (const c of text) {
    if (c === char) run++;
    else if (run) {
      lengths.add(run);
      run = 0;
    }
  }
  if (run) lengths.add(run);
  let length = 1;
  while (lengths.has(length)) length++;
  return length;
}

function longestRun(text: string, char: string): number {
  let longest = 0;
  let run = 0;
  for (const c of text) {
    run = c === char ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
