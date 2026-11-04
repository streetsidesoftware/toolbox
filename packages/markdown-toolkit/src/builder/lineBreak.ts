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
  return new MarkdownElement('inline', 'lineBreak', 'a line break', [{ type: 'break' }]);
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
  return new MarkdownElement('inline', 'br', 'a <br/>', [{ type: 'html', value: '<br/>' }]);
}
