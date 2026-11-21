import type { Found } from '../scan/index.ts';
import { scanHidden } from '../scan/index.ts';
import { reveal, revealStyle } from './reveal.ts';

/**
 * What removal leaves in place of each piece of hidden text, so the text on either side can't join into new hidden text,
 * such as a new comment.
 */
const ZERO_WIDTH_SPACE = '\u200B';

/**
 * Remove the text in Markdown that the page doesn't show, or show it on the page.
 *
 * The hidden text is what {@link findHidden} finds. The rest of the Markdown stays as it is.
 *
 * - `remove` replaces each piece of hidden text with a zero-width space, so the text on either side can't join into
 *   new hidden text. The result hides nothing.
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
  if (mode === 'remove') return replaceAll(markdown, found, () => ZERO_WIDTH_SPACE);
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
