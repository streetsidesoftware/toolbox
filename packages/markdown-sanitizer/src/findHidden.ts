import { scanHidden } from './scan.ts';
import type { HiddenText } from './types.ts';

/**
 * Find the text in Markdown that the page doesn't show, though an agent reading the Markdown does.
 *
 * It finds:
 * - HTML comments, except in code, where the page shows them.
 * - Link definitions and footnotes that the page leaves out, such as `[//]: # (note)`.
 * - Unicode tag characters and variation selectors, except the ones that make up an emoji.
 *
 * Other invisible characters, such as the zero-width space, aren't reported.
 *
 * Each result gives the hidden text, its kind, and where it is in the Markdown. The results come in order and don't
 * overlap.
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
