/**
 * What hides a piece of text from the page:
 * - `comment`: an HTML comment, or other HTML that the page hides the same way, such as `<?…>`.
 * - `definition`: a link definition that no link uses, such as `[//]: # (note)`.
 * - `footnote`: a footnote that the page leaves out.
 * - `invisible`: Unicode tag characters or variation selectors, as characters or as references such as `&#xE0041;`.
 */
export type HiddenKind = 'comment' | 'definition' | 'footnote' | 'invisible';

/** A piece of Markdown that the page doesn't show, though anyone reading the Markdown itself can. */
export interface HiddenText {
  /** What hides the text. */
  kind: HiddenKind;
  /** The offset in the Markdown where the hidden text starts. */
  start: number;
  /** The offset in the Markdown just past the hidden text. */
  end: number;
  /** The line where the hidden text starts, from 1. */
  line: number;
  /** The column where the hidden text starts, from 1, counted in UTF-16 code units as editors do. */
  column: number;
  /** The hidden text, exactly as it is in the Markdown. */
  text: string;
}
