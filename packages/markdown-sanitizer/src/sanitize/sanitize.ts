import type { Found } from '../scan/index.ts';
import { scanHidden } from '../scan/index.ts';
import { reveal, revealStyle } from './reveal.ts';

/**
 * The most passes removal takes before it gives up on Markdown that keeps hiding text. Removing hidden text can join
 * what was around it into new hidden text, such as a new comment, so removal repeats until nothing is hidden.
 */
const MAX_PASSES = 100;

/**
 * Remove the text in Markdown that the page doesn't show, or show it on the page.
 *
 * The hidden text is what {@link findHidden} finds. The rest of the Markdown stays as it is.
 *
 * - `remove` takes the hidden text out. The result hides nothing.
 * - `reveal` shows the hidden text on the page as code, so a reviewer sees what an agent reads. Tag characters and
 *   variation selectors show as their code points, such as `\u{E0041}`.
 *
 * An agent reads revealed text too, so for Markdown that agents read, use `remove`.
 *
 * Markdown that still hides text after 100 rounds of removal isn't allowed.
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
