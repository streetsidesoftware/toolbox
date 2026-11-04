import { MarkdownElement } from '../element/index.ts';
import type { MDCodeBlock, MDInlineCode } from '../types.ts';

/**
 * Create code within a line of text.
 *
 * Empty code shows as one space of code, so the reader still sees it.
 *
 * @example
 * md.inlineCode('npm install');
 * // `npm install`
 * @category code
 */
export function inlineCode(code: string): MDInlineCode {
  return new MarkdownElement('inline', 'inlineCode', 'inline code', [{ type: 'inlineCode', value: code }]);
}

/**
 * Create a block of code.
 *
 * @param lang - the language, such as `ts` or `sh`, so the page can highlight the code.
 * @example
 * md.codeBlock('npm install', 'sh');
 * // ```sh
 * // npm install
 * // ```
 * @category code
 */
export function codeBlock(code: string, lang?: string): MDCodeBlock {
  return new MarkdownElement('block', 'codeBlock', 'a code block', [{ type: 'code', lang: lang || null, value: code }]);
}
