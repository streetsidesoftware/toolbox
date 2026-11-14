import { replacePlaceholders } from '@streetsidesoftware/placeholders';

import { DocumentElement, isHtmlEntity, text } from '../builder/index.ts';
import { paragraphContent, paragraphNode, substituteNodes } from '../core/index.ts';
import type { PhrasingContent } from '../core/index.ts';
import { assertIsMDElement, isText, MarkdownElement, markdownInternalsOf } from '../element/index.ts';
import type {
  MDBlockPlaceholder,
  MDElement,
  MDFragment,
  MDInline,
  MDInlineFragment,
  MDParagraph,
  MDPlaceholder,
  MDText,
} from '../types.ts';
import { fragmentOf } from './fragment.ts';
import { placeholderReplacements, resolverOf } from './replacements.ts';
import type { TemplateReplacements, TemplateResolver } from './replacements.ts';

/**
 * Replace the `{​@ name @​}` placeholders in an existing element, such as a parsed file, or in plain text.
 *
 * When the first argument is a string, its Markdown and HTML show as text, not as formatting, and each newline is a
 * line break. For a string that's already Markdown, use {@link template}.
 *
 * - A string shows as text, not as formatting, with each newline as a line break.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string or an {@link htmlEntity}. A string goes in as given. An
 *   entity shows as its character in code, and as its reference in HTML.
 * - A placeholder in a link or image URL, a title or a reference definition takes only a string, which goes in as given.
 *   Markdown allows no spaces in a URL, so write `{​@name@​}` there, or wrap the URL in `<…>`.
 * - A placeholder without a replacement stays in place, so a later call can substitute it.
 *
 * @param replacements - by placeholder name, or a {@link TemplateResolver}. In an object, a dotted name, such as
 *   `engines.cspell`, reaches into a nested object.
 * @example
 * const page = md.p('Hello ', md.placeholder('name'), '.');
 * md.substitutePlaceholders(page, { name: 'world' });
 * // Hello world.
 * @example
 * md.substitutePlaceholders('Version: {@version@}', { version: '1.2.3' });
 * // Version: 1.2.3
 * @category templates
 */
export function substitutePlaceholders(
  content: string | MDText,
  replacements: TemplateReplacements | TemplateResolver,
): MDText | MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDInlineFragment,
  replacements: TemplateReplacements | TemplateResolver,
): MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDParagraph,
  replacements: TemplateReplacements | TemplateResolver,
): MDParagraph | MDFragment;

export function substitutePlaceholders(
  content: MDPlaceholder,
  replacements: TemplateReplacements | TemplateResolver,
): MDPlaceholder | MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDBlockPlaceholder,
  replacements: TemplateReplacements | TemplateResolver,
): MDBlockPlaceholder | MDFragment;

export function substitutePlaceholders(
  content: MDInline,
  replacements: TemplateReplacements | TemplateResolver,
): MDInline | MDFragment;

export function substitutePlaceholders<T extends MDElement>(
  content: T,
  replacements: TemplateReplacements | TemplateResolver,
): T;

export function substitutePlaceholders(
  content: MDElement | string,
  replacements: TemplateReplacements | TemplateResolver,
): MDElement {
  if (typeof content === 'string') return substitutePlaceholders(text(content), replacements);
  const resolve = resolverOf(replacements);
  assertIsMDElement(content, 'a string or a Markdown element');
  const markdownInternals = markdownInternalsOf(content);
  // An HTML entity has no placeholder in it, and keeps its character.
  if (isHtmlEntity(content)) return content;
  const substituted = isText(content) ? substituteInText(content.text, resolve) : undefined;
  if (substituted !== undefined) return text(substituted);
  const { style } = markdownInternals;
  const nodes = structuredClone(markdownInternals.nodes);
  const forPlaceholders = placeholderReplacements(resolve);
  switch (content.type) {
    case 'text':
    case 'inlineFragment':
      return fragmentOf(substituteNodes([paragraphNode(nodes as PhrasingContent[])], forPlaceholders, true), style);
    case 'paragraph': {
      const substitutedNodes = substituteNodes(nodes, forPlaceholders, true);
      if (substitutedNodes.length === 1 && paragraphContent(substitutedNodes)) {
        return new MarkdownElement('block', 'paragraph', 'a paragraph', substitutedNodes, style);
      }
      return new MarkdownElement('block', 'fragment', 'a Markdown fragment', substitutedNodes, style);
    }
    case 'placeholder':
      if (resolve((content as MDPlaceholder).name) === undefined) return content;
      return fragmentOf(substituteNodes([paragraphNode(nodes as PhrasingContent[])], forPlaceholders, true), style);
    case 'blockPlaceholder':
      if (resolve((content as MDBlockPlaceholder).name) === undefined) return content;
      return new MarkdownElement(
        'block',
        'fragment',
        'a Markdown fragment',
        substituteNodes(nodes, forPlaceholders, true),
        style,
      );
    case 'document':
      return new DocumentElement(substituteNodes(nodes, forPlaceholders, true), style);
    default:
      return new MarkdownElement(
        content.kind,
        content.type,
        content.description,
        substituteNodes(nodes, forPlaceholders, content.kind !== 'inline'),
        style,
      );
  }
}

/**
 * Return the text with its placeholders substituted, or `undefined` if a replacement isn't a string or text.
 * A placeholder with no replacement is kept as written.
 */
function substituteInText(text: string, resolve: TemplateResolver): string | undefined {
  let onlyText = true;
  const result = replacePlaceholders(text, (name: string) => {
    const replacement = resolve(name);
    if (replacement === undefined) return undefined;
    if (typeof replacement === 'string' || typeof replacement === 'number' || typeof replacement === 'boolean') {
      return String(replacement);
    }
    if (isText(replacement)) return replacement.text;
    onlyText = false;
    return undefined;
  });
  return onlyText ? result : undefined;
}
