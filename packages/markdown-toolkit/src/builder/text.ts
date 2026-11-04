import type { Paragraph } from 'mdast';

import { MarkdownElement, stringNodes, textNodes } from '../element/index.ts';
import type { MDFragment, MDText } from '../types.ts';

class TextElement extends MarkdownElement<'inline', 'text'> implements MDText {
  readonly text: string;

  constructor(text: string) {
    super('inline', 'text', 'text', stringNodes(text));
    this.text = text;
  }
}

/**
 * Create text whose Markdown and HTML show on the page as text, not as formatting.
 *
 * A newline in it starts a new line.
 *
 * @example
 * md.text('Use <details> for *long* notes');
 * // The page shows: Use <details> for *long* notes
 * @category text
 */
export function text(value: string): MDText {
  return new TextElement(value);
}

/** The same as {@link text}. */
export const inlineText: typeof text = text;

/**
 * Create paragraphs from plain text, starting a new one at each blank line.
 *
 * Markdown and HTML in the text show as text, not as formatting. A single newline shows as a space, so text wrapped at
 * a fixed width reads as normal paragraphs.
 *
 * @example
 * md.blockText('First paragraph.\n\nSecond paragraph.');
 * // First paragraph.
 * //
 * // Second paragraph.
 * @category text
 */
export function blockText(value: string): MDFragment {
  const paragraphs: Paragraph[] = [];
  let lines: string[] = [];
  for (const line of value.split(/\r\n?|\n/)) {
    if (/^[ \t]*$/.test(line)) {
      endParagraph();
      continue;
    }
    lines.push(line);
  }
  endParagraph();
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', paragraphs);

  function endParagraph(): void {
    if (lines.length) paragraphs.push({ type: 'paragraph', children: textNodes(lines.join('\n')) });
    lines = [];
  }
}
