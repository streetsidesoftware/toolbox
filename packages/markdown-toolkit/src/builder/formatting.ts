import { deleteNode, emphasisNode, inlineHtmlNode, strongNode } from '../core/index.ts';
import type { PhrasingContent } from '../core/index.ts';
import { inlineNodes, MarkdownElement } from '../element/index.ts';
import type { InlineContent, MDEmphasis, MDStrikethrough, MDStrong, MDSub, MDSup } from '../types.ts';

/**
 * Create bold text.
 *
 * Empty text shows as one bold space.
 *
 * @example
 * md.strong('important');
 * // **important**
 * @category formatting
 */
export function strong(content: InlineContent): MDStrong {
  return new MarkdownElement('inline', 'strong', 'strong text', [strongNode(inlineNodes(content, 'strong content'))]);
}

/**
 * Create italic text.
 *
 * Empty text shows as one italic space.
 *
 * @example
 * md.emphasis('maybe');
 * // _maybe_
 * @category formatting
 */
export function emphasis(content: InlineContent): MDEmphasis {
  return new MarkdownElement('inline', 'emphasis', 'emphasized text', [
    emphasisNode(inlineNodes(content, 'emphasis content')),
  ]);
}

/**
 * Create text with a line through it.
 *
 * Empty text shows as one struck-through space.
 *
 * @example
 * md.strikethrough('old price');
 * // ~~old price~~
 * @category formatting
 */
export function strikethrough(content: InlineContent): MDStrikethrough {
  return new MarkdownElement('inline', 'strikethrough', 'struck-through text', [
    deleteNode(inlineNodes(content, 'strikethrough content')),
  ]);
}

/**
 * Create superscript text, raised above the line.
 *
 * It can hold text, links, formatting or code, including {@link sub}.
 *
 * Empty text shows nothing.
 *
 * The Markdown holds `<sup>` and `</sup>` tags, so the page must render HTML.
 *
 * @example
 * md.sup(md.emphasis('req'));
 * // <sup>_req_</sup>
 * @category formatting
 */
export function sup(content: InlineContent): MDSup {
  return new MarkdownElement('inline', 'sup', 'superscript text', htmlWrapped('sup', content, 'superscript content'));
}

/**
 * Create subscript text, lowered below the line.
 *
 * It can hold text, links, formatting or code, including {@link sup}.
 *
 * Empty text shows nothing.
 *
 * The Markdown holds `<sub>` and `</sub>` tags, so the page must render HTML.
 *
 * @example
 * md.sub('2');
 * // <sub>2</sub>
 * @category formatting
 */
export function sub(content: InlineContent): MDSub {
  return new MarkdownElement('inline', 'sub', 'subscript text', htmlWrapped('sub', content, 'subscript content'));
}

/** Return the nodes for inline content between an HTML tag's start and end. */
function htmlWrapped(tag: string, content: InlineContent, where: string): PhrasingContent[] {
  return [inlineHtmlNode(`<${tag}>`), ...inlineNodes(content, where), inlineHtmlNode(`</${tag}>`)];
}
