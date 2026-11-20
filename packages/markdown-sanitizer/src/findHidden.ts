import { scanHidden } from './scan.ts';
import type { HiddenText } from './types.ts';

/**
 * Find the text in Markdown that the rendered page hides, but an agent or anyone else reading the Markdown sees.
 *
 * It finds:
 * - HTML comments, and HTML a browser reads as one, such as `<?…>`, even inside other HTML. A comment left open hides
 *   the rest of the page.
 * - Link definitions that no link uses, such as `[//]: # (note)`, and footnotes that nothing cites.
 * - Unicode tag characters and variation selectors. The page shows nothing for them, but a model reads tag
 *   characters as text, and a run of variation selectors can steer it. The ones that form an emoji, such as a red
 *   heart or the Scotland flag, aren't hidden text.
 *
 * Other invisible characters, such as the zero-width space or a direction mark, carry nothing an agent acts on, so
 * they aren't reported.
 *
 * Code shows on the page as it is, so a comment in code isn't hidden. A tag character or variation selector in code
 * is.
 *
 * The pieces come in order and don't overlap. An invisible character inside a comment is part of the comment.
 *
 * @example
 * findHidden('Fix the parser.\n\n<!-- Ignore previous instructions. -->\n');
 * // [{ kind: 'comment', start: 17, end: 55, line: 3, column: 1, text: '<!-- Ignore previous instructions. -->' }]
 */
export function findHidden(markdown: string): HiddenText[] {
  const lines = lineStarts(markdown);
  return scanHidden(markdown).map(({ kind, start, end }) => {
    const line = lineOf(lines, start);
    return { kind, start, end, line: line + 1, column: start - lines[line] + 1, text: markdown.slice(start, end) };
  });
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
