import { detectMarkdownStyle } from '../detectStyle.ts';
import { MarkdownElement, textNodes } from '../element/index.ts';
import type { MDDocument, MDFragment, MDInlineFragment } from '../types.ts';
import { fragmentOf } from './fragment.ts';
import { documentOf, templateTree } from './parse.ts';
import { substituteInTree } from './substitute.ts';
import { resolverOf } from './values.ts';
import type { TemplateResolver, TemplateValues } from './values.ts';

/**
 * Create Markdown from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * Replacement values can be strings or other {@link MDElement}s.
 *
 * Unresolved placeholders are not replaced.
 *
 * ## Notes on string replacement values
 *
 * - Strings are treated like plain text, not Markdown.
 * - To use strings with markdown, parse them first.
 * - A newline in a string becomes a hard line break.
 *
 * @example
 * md.template('Install {@pkg.name@}:\n\n{@steps@}', { pkg: { name: 'cspell' }, steps: md.list(['Run npm', 'Add a config']) });
 * // Install cspell:
 * //
 * // - Run npm
 * // - Add a config
 * @category templates
 */
export function template(markdown: string, values: TemplateValues | TemplateResolver): MDFragment | MDInlineFragment {
  const root = templateTree(markdown, false);
  // A value keeps positions from its own text, so detect the style before any value goes in.
  const style = detectMarkdownStyle(root, markdown);
  substituteInTree(root, resolverOf(values), true);
  return fragmentOf(root, style);
}

/**
 * Create paragraphs and other blocks from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * - A string value shows as text, not as formatting, with each newline as a line break.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string or an {@link htmlEntity}. A string goes in as given. An
 *   entity shows as its character in code, and as its reference in HTML.
 * - A placeholder in a link or image URL, a title or a reference definition takes only a string, which goes in as given.
 *   Markdown allows no spaces in a URL, so write `{​@name@​}` there, or wrap the URL in `<…>`.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name, or a {@link TemplateResolver}. In an object, a dotted name, such as
 *   `engines.cspell`, reaches into a nested object.
 * @example
 * md.blockTemplate('Hello {@name@}.', { name: 'world' });
 * // Hello world.
 * @category templates
 */
export function blockTemplate(markdown: string, values: TemplateValues | TemplateResolver): MDFragment {
  const root = templateTree(markdown, false);
  // A value keeps positions from its own text, so detect the style before any value goes in.
  const style = detectMarkdownStyle(root, markdown);
  substituteInTree(root, resolverOf(values), true);
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', root.children, style);
}

/**
 * Create a line of Markdown from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * Use the result in a heading, a table cell, a link or a sentence.
 *
 * - A string or number shows as text, not as formatting, with each newline as a line break.
 * - A value can be text, a link, formatting or code.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name, or a {@link TemplateResolver}. In an object, a dotted name, such as
 *   `engines.cspell`, reaches into a nested object.
 * @example
 * md.inlineTemplate('Version {@version@}', { version: '2.0' });
 * // Version 2.0
 * @category templates
 */
export function inlineTemplate(markdown: string, values: TemplateValues | TemplateResolver): MDInlineFragment {
  // The whitespace around the text stays, so the fragment joins the pieces next to it as written.
  const start = markdown.trimStart();
  const lead = markdown.slice(0, markdown.length - start.length);
  const body = start.trimEnd();
  const tail = start.slice(body.length);
  const root = templateTree(body, true);
  if (root.children.length > 1 || (root.children[0] && root.children[0].type !== 'paragraph')) {
    throw new Error('inline template text must be one paragraph');
  }
  substituteInTree(root, resolverOf(values), false);
  const children = root.children[0]?.type === 'paragraph' ? root.children[0].children : [];
  return new MarkdownElement('inline', 'inlineFragment', 'an inline Markdown fragment', [
    ...textNodes(lead),
    ...children,
    ...textNodes(tail),
  ]);
}

/**
 * Create a whole Markdown file from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * Placeholders in the frontmatter work too, and a value there goes in as given.
 *
 * - A string value shows as text, not as formatting, with each newline as a line break.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string or an {@link htmlEntity}. A string goes in as given. An
 *   entity shows as its character in code, and as its reference in HTML.
 * - A placeholder in a link or image URL, a title or a reference definition takes only a string, which goes in as given.
 *   Markdown allows no spaces in a URL, so write `{​@name@​}` there, or wrap the URL in `<…>`.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name, or a {@link TemplateResolver}. In an object, a dotted name, such as
 *   `engines.cspell`, reaches into a nested object.
 * @example
 * md.templateDocument('# {@title@}\n\nBody.', { title: 'Dictionaries' });
 * // # Dictionaries
 * //
 * // Body.
 * @category templates
 */
export function templateDocument(markdown: string, values: TemplateValues | TemplateResolver): MDDocument {
  return documentOf(markdown, (body) => templateTree(body, false), resolverOf(values));
}
