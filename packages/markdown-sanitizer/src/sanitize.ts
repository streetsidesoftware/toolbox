import { findInvisibleCharacters } from './invisible.ts';
import type { Found } from './scan.ts';
import { scanHidden } from './scan.ts';

/** The most passes removal takes before it gives up on Markdown that keeps hiding text. */
const MAX_PASSES = 100;

/**
 * Remove the text in Markdown that the rendered page hides, or show it on the page.
 *
 * The hidden text is what {@link findHidden} finds. The rest of the Markdown stays exactly as it is.
 *
 * - `remove` takes the hidden text out. Taking it out can join what was around it into new hidden text, such as a
 *   new comment, so removal repeats until nothing is hidden.
 * - `reveal` shows the hidden text on the page as code, so a reviewer can see it:
 *   - A comment, unused definition or footnote shows exactly as an agent reads it. Inside a line it becomes code in
 *     the line. On lines of its own it becomes a code block. Inside other HTML it becomes HTML code.
 *   - Each tag character or variation selector shows as an escape, such as `\u{E0041}`, so a model doesn't read
 *     the text it spells.
 *
 * Revealed text is for a reviewer. An agent reads it too, so use `remove` for Markdown that agents read.
 *
 * Markdown that still hides text after 100 passes of removal isn't allowed.
 *
 * @example
 * sanitize('Fix the <!-- secret --> parser.', 'reveal');
 * // Fix the `<!-- secret -->` parser.
 */
export function sanitize(markdown: string, mode: 'remove' | 'reveal'): string {
  if (mode === 'reveal') {
    const style = revealStyle(markdown);
    return replaceAll(markdown, scanHidden(markdown), (found, previous) => reveal(markdown, found, previous, style));
  }

  let text = markdown;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const found = scanHidden(text);
    if (!found.length) return text;
    text = replaceAll(text, found, () => '');
  }
  throw new Error(`Markdown must not hide text that is still hidden after ${MAX_PASSES} passes of removal`);
}

/**
 * Replace each piece of hidden text with what `replacement` returns for it.
 * @param replacement - gets the character the output has so far ended with, or `''`.
 */
function replaceAll(markdown: string, found: Found[], replacement: (found: Found, previous: string) => string): string {
  const parts: string[] = [];
  let pos = 0;
  let previous = '';
  for (const piece of found) {
    const before = markdown.slice(pos, piece.start);
    const replaced = replacement(piece, before.at(-1) ?? previous);
    parts.push(before, replaced);
    previous = replaced.at(-1) ?? before.at(-1) ?? previous;
    pos = piece.end;
  }
  parts.push(markdown.slice(pos));
  return parts.join('');
}

/** What revealed code looks like in a document, so it fits the text around it. */
interface RevealStyle {
  /** The backticks of a code span: a run no other run in the document matches, so no other run pairs with it. */
  ticks: string;
  /** The document's line ending, for the lines a code block adds. */
  lineEnding: string;
}

function revealStyle(markdown: string): RevealStyle {
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
function reveal(markdown: string, found: Found, previous: string, style: RevealStyle): string {
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
 * Replace each tag character and variation selector with an escape, such as `\u{E0041}`.
 * Character references stay as they are: they show as text in code.
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
