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
 * - `reveal` shows each comment, unused definition or footnote on the page as code, exactly as an agent reads it.
 *   Inside a line it becomes code in the line. On lines of its own it becomes a code block. Inside other HTML it
 *   becomes HTML code.
 *
 * Removal gives up on Markdown that still hides text after 100 passes.
 *
 * @example
 * sanitize('Fix the <!-- secret --> parser.', 'reveal');
 * // Fix the `<!-- secret -->` parser.
 */
export function sanitize(markdown: string, mode: 'remove' | 'reveal'): string {
  if (mode === 'reveal') return replaceAll(markdown, scanHidden(markdown), reveal);

  let text = markdown;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const found = scanHidden(text);
    if (!found.length) return text;
    text = replaceAll(text, found, () => '');
  }
  throw new Error(`Markdown must not hide text that is still hidden after ${MAX_PASSES} passes of removal`);
}

/** Replace each piece of hidden text with what `replacement` returns for it. */
function replaceAll(markdown: string, found: Found[], replacement: (markdown: string, found: Found) => string): string {
  const parts: string[] = [];
  let pos = 0;
  for (const piece of found) {
    parts.push(markdown.slice(pos, piece.start), replacement(markdown, piece));
    pos = piece.end;
  }
  parts.push(markdown.slice(pos));
  return parts.join('');
}

/** Show a piece of hidden text as code. Invisible characters stay as they are. */
function reveal(markdown: string, found: Found): string {
  const text = markdown.slice(found.start, found.end);
  switch (found.kind === 'invisible' ? 'invisible' : found.placement) {
    case 'invisible':
      return text;
    case 'inline': {
      const ticks = '`'.repeat(longestRun(text, '`') + 1);
      return ticks + text + ticks;
    }
    case 'html':
      return `<code>${escapeHtml(text)}</code>`;
    default:
      return codeBlock(markdown, found, text);
  }
}

/**
 * Show hidden text as a code block in the same quote or list item as the block it starts in.
 *
 * Each of its lines gets the quote and list indentation of that block, so a comment left open that ran out of the
 * quote ends up inside it. Its own lines keep their quote markers, which then show in the code as an agent reads them.
 */
function codeBlock(markdown: string, found: Found, text: string): string {
  const lineStart = startOfLine(markdown, found.anchor);
  const indent = continuation(markdown.slice(lineStart, found.anchor));
  const fence = '`'.repeat(Math.max(3, longestRun(text, '`') + 1));
  const lines = text.split(/\r\n|\r|\n/).map((line) => indent + line);
  const before = found.anchor < found.start ? `\n${indent.trimEnd()}\n${indent}` : '';
  const after = isLineEnd(markdown, found.end) ? '' : `\n${indent}`;
  return `${before}${fence}\n${lines.join('\n')}\n${indent}${fence}${after}`;
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
