import type { Found } from '../scan/index.ts';
import { scanHidden } from '../scan/index.ts';
import { reveal, revealStyle } from './reveal.ts';

/**
 * What removal leaves in place of hidden text, so the text on either side can't join into new hidden text, such as a new
 * comment.
 */
const ZERO_WIDTH_SPACE = '\u200B';

/**
 * The characters that can come before the spaces at the start of a line's content: a line break, the byte order mark,
 * and the characters that end a list, quote or footnote marker.
 */
const lineStartChars = new Set(['\n', '\r', '\uFEFF', '-', '*', '+', '>', '.', ')', ':']);

/**
 * Remove the text in Markdown that the page doesn't show, or show it on the page.
 *
 * The hidden text is what {@link findHidden} finds. The rest of the Markdown stays as it is.
 *
 * - `remove` takes the hidden text out. It leaves a zero-width space in its place, unless a space after other text
 *   comes before it, so the text on either side can't join into new hidden text. The result hides nothing.
 * - `reveal` shows the hidden text on the page as code, so a reviewer sees what an agent reads. Tag characters and
 *   variation selectors show as their code points, such as `\u{E0041}`.
 *
 * An agent reads revealed text too, so for Markdown that agents read, use `remove`.
 *
 * @example
 * sanitize('Fix the <!-- secret --> parser.', 'reveal');
 * // Fix the `<!-- secret -->` parser.
 */
export function sanitize(markdown: string, mode: 'remove' | 'reveal'): string {
  const found = scanHidden(markdown);
  if (mode === 'remove') {
    return replaceAll(markdown, found, ({ start }) => (afterTextAndSpace(markdown, start) ? '' : ZERO_WIDTH_SPACE));
  }
  const style = revealStyle(markdown);
  return replaceAll(markdown, found, (piece, previous) => reveal(markdown, piece, previous, style));
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

/**
 * Whether spaces come before `start`, after text on the same line. Nothing can join across a space, and the rest of the
 * line can't start a block of its own, such as a definition.
 *
 * It may answer no where removal could leave nothing, such as after a hyphen in a sentence, but never yes where it
 * can't.
 */
function afterTextAndSpace(markdown: string, start: number): boolean {
  let pos = start;
  while (pos > 0 && (markdown[pos - 1] === ' ' || markdown[pos - 1] === '\t')) pos--;
  return pos < start && pos > 0 && !lineStartChars.has(markdown[pos - 1]);
}
