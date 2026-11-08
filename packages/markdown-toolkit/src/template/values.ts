import type { PhrasingContent } from 'mdast';

import { isHtmlEntity } from '../builder/index.ts';
import {
  describe,
  groupedNodes,
  inlineNodes,
  isArray,
  isKind,
  isText,
  MarkdownElement,
  renderingOf,
  textNodes,
} from '../element/index.ts';
import type { AnyContent, InlineContent, MDElement } from '../types.ts';

export type TemplateValue = string | number | boolean | MDElement | readonly TemplateValue[];

/**
 * The values for a template, by placeholder name.
 * - A top-level key may be a dotted name, such as `'engines.cspell'`.
 * - A nested object is walked one segment at a time.
 * - When several keys could supply a name, the later key wins.
 */
export interface TemplateValues {
  readonly [name: string]: TemplateValue | TemplateValues | undefined;
}

/**
 * Returns the value for a placeholder name, or `undefined` to leave the placeholder in place.
 *
 * - It gets the whole name, such as `engines.cspell`.
 * - It may be called more than once for the same name.
 *
 * @example
 * md.template('Version {@version@}', (name) => (name === 'version' ? '2.0' : undefined));
 * // Version 2.0
 */
export type TemplateResolver = (name: string) => TemplateValue | undefined;

/** Return a lookup for the values. A resolver's result that isn't a template value counts as no value. */
export function resolverOf(values: TemplateValues | TemplateResolver): TemplateResolver {
  if (typeof values !== 'function') return (name) => resolveValue(values, name);
  return (name) => {
    const value: unknown = values(name);
    return isTemplateValue(value) ? value : undefined;
  };
}

/**
 * Look up a placeholder name.
 * Each top-level key acts as a declaration, and the newest one wins:
 * - Keys are tried from last to first.
 * - A key matches when it equals the name, or a leading part of it whose rest resolves inside its value.
 * - A key that doesn't supply the name doesn't stop the search.
 */
export function resolveValue(values: TemplateValues, name: string): TemplateValue | undefined {
  const keys = Object.keys(values);
  for (let i = keys.length - 1; i >= 0; --i) {
    const key = keys[i];
    const value =
      key === name
        ? values[key]
        : name.startsWith(key + '.')
          ? walk(values[key], name.slice(key.length + 1))
          : undefined;
    if (isTemplateValue(value)) return value;
  }
  return undefined;
}

/** Walk a dotted name into nested objects, one segment per level. Only own properties count. */
function walk(value: unknown, name: string): unknown {
  let cur = value;
  for (const segment of name.split('.')) {
    if (!isPlainObject(cur) || !Object.hasOwn(cur, segment)) return undefined;
    cur = cur[segment];
  }
  return cur;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !renderingOf(value);
}

function isTemplateValue(value: unknown): value is TemplateValue {
  const t = typeof value;
  return (
    t === 'string' || t === 'number' || t === 'boolean' || renderingOf(value) !== undefined || Array.isArray(value)
  );
}

export function valueAsInline(value: TemplateValue, name: string): PhrasingContent[] {
  if (typeof value === 'number' || typeof value === 'boolean') return textNodes(String(value));
  // A template value can be any kind. inlineNodes throws when it isn't inline.
  return inlineNodes(value as InlineContent, `{@ ${name} @}`);
}

/**
 * Convert a value for use inside code or HTML, as `inside` says.
 * Only a string, text, a placeholder or an HTML entity goes in, as is.
 * An entity goes in as its reference in HTML, which reads it, and as its character in code, which doesn't.
 */
export function valueAsCode(value: TemplateValue, name: string, inside: 'code' | 'HTML'): string {
  const plain = valueAsPlainText(value);
  if (plain !== undefined) return plain;
  if (isHtmlEntity(value)) return inside === 'HTML' ? value.toString() : value.character;
  throw new TypeError(
    `{@ ${name} @} is inside ${inside} and takes only a string, text, a placeholder or an HTML entity, got ${describe(value)}`,
  );
}

/** Convert a value for use in a link's URL or title. Only a string, text or a placeholder goes in, as is. */
export function valueInLink(value: TemplateValue, name: string, inside: 'a URL' | 'a title'): string {
  const plain = valueAsPlainText(value);
  if (plain !== undefined) return plain;
  throw new TypeError(
    `{@ ${name} @} is inside ${inside} and takes only a string, text or a placeholder, got ${describe(value)}`,
  );
}

/** Return `undefined` for a value that isn't plain text, such as a link or an HTML entity. */
function valueAsPlainText(value: TemplateValue): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isText(value)) return value.text;
  if (isKind(value, 'inline') && value.type === 'placeholder') return value.toString();
  return undefined;
}

/**
 * Convert a value for use inside frontmatter, as is: a string as written, and a Markdown element as rendered.
 * An HTML entity goes in as its character, since YAML doesn't read references.
 */
export function valueAsFrontmatter(value: TemplateValue): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isText(value)) return value.text;
  if (isHtmlEntity(value)) return value.character;
  // A template value can be any kind. groupedNodes throws when a piece isn't Markdown content.
  if (!isArray(value)) return value.toString();
  return new MarkdownElement(
    'block',
    'fragment',
    'content',
    groupedNodes(value as AnyContent, 'frontmatter value'),
  ).toString();
}
