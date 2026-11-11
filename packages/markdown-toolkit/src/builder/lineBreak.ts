import { breakNode, htmlNode } from '../core/index.ts';
import { MarkdownElement } from '../element/index.ts';
import type { MDBr, MDLineBreak } from '../types.ts';

/**
 * Start a new line without starting a new paragraph.
 *
 * It works anywhere a string can go, even in a heading or a table cell.
 *
 * @example
 * md.p('Line one', md.lineBreak(), 'line two');
 * // The page shows "Line one" and "line two" on separate lines.
 * @category line-breaks
 */
export function lineBreak(): MDLineBreak {
  return new MarkdownElement('inline', 'lineBreak', 'a line break', [breakNode()]);
}

/**
 * Start a new line with an HTML `<br/>` tag.
 *
 * The Markdown always contains `<br/>`, wherever it goes.
 *
 * @example
 * md.p('Line one', md.br(), 'line two');
 * // Line one<br/>line two
 * @category line-breaks
 */
export function br(): MDBr {
  // Never `<br>`: MDX reads HTML as JSX, where an unclosed tag is a syntax error.
  return new MarkdownElement('inline', 'br', 'a <br/>', [htmlNode('<br/>')]);
}
