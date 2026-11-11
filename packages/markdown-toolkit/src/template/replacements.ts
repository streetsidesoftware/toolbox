import type { PhrasingContent } from 'mdast';

import { isHtmlEntity } from '../builder/index.ts';
import {
  assertUnhandledCase,
  groupedNodes,
  inlineNodes,
  isArray,
  isKind,
  isMDElement,
  isText,
  MarkdownElement,
  textNodes,
} from '../element/index.ts';
import type { AnyContent, InlineContent, MDElement } from '../types.ts';

export type TemplateReplacement = string | number | boolean | MDElement | readonly TemplateReplacement[];

/** @deprecated Use {@link TemplateReplacement}. */
export type TemplateValue = TemplateReplacement;

/** An object of replacements, keyed by placeholder name. */
export interface TemplateReplacements {
  readonly [name: string]: TemplateReplacement | TemplateReplacements | undefined;
}

/** @deprecated Use {@link TemplateReplacements}. */
export type TemplateValues = TemplateReplacements;

/**
 * Returns the replacement for a placeholder name, or `undefined` to leave the placeholder in place.
 *
 * - It gets the whole name, such as `engines.cspell`.
 * - It may be called more than once for the same name.
 *
 * @example
 * md.template('Version {@version@}', (name) => (name === 'version' ? '2.0' : undefined));
 * // Version 2.0
 */
export type TemplateResolver = (name: string) => TemplateReplacement | undefined;

/** Return a lookup for the replacements. A resolver's result that isn't a replacement counts as no replacement. */
export function resolverOf(replacements: TemplateReplacements | TemplateResolver): TemplateResolver {
  if (typeof replacements !== 'function') return (name) => resolveReplacement(replacements, name);
  return (name) => {
    const result: unknown = replacements(name);
    return isTemplateReplacement(result) ? result : undefined;
  };
}

/**
 * Look up a placeholder name.
 * Each top-level key acts as a declaration, and the newest one wins:
 * - Keys are tried from last to first.
 * - A key matches when it equals the name, or a leading part of it whose rest resolves inside its value.
 * - A key that doesn't supply the name doesn't stop the search.
 */
export function resolveReplacement(replacements: TemplateReplacements, name: string): TemplateReplacement | undefined {
  const keys = Object.keys(replacements);
  for (let i = keys.length - 1; i >= 0; --i) {
    const key = keys[i];
    const value =
      key === name
        ? replacements[key]
        : name.startsWith(key + '.')
          ? walk(replacements[key], name.slice(key.length + 1))
          : undefined;
    if (isTemplateReplacement(value)) return value;
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
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isMDElement(value);
}

function isTemplateReplacement(value: unknown): value is TemplateReplacement {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean' || isMDElement(value) || Array.isArray(value);
}

export function replacementAsInline(replacement: TemplateReplacement, name: string): PhrasingContent[] {
  if (typeof replacement === 'number' || typeof replacement === 'boolean') return textNodes(String(replacement));
  // A replacement can be any kind. inlineNodes throws when it isn't inline.
  return inlineNodes(replacement as InlineContent, `{@ ${name} @}`);
}

/**
 * Convert a replacement for use inside code or HTML, as `inside` says.
 * Only a string, text, a placeholder or an HTML entity goes in, as is.
 * An entity goes in as its reference in HTML, which reads it, and as its character in code, which doesn't.
 */
export function replacementAsCode(replacement: TemplateReplacement, name: string, inside: 'code' | 'HTML'): string {
  const plain = replacementAsPlainText(replacement);
  if (plain !== undefined) return plain;
  if (isHtmlEntity(replacement)) return inside === 'HTML' ? replacement.toString() : replacement.character;
  assertUnhandledCase(
    `{@ ${name} @} is inside ${inside} and takes only a string, text, a placeholder or an HTML entity`,
  );
}

/** Convert a replacement for use in a link's URL or title. Only a string, text or a placeholder goes in, as is. */
export function replacementInLink(replacement: TemplateReplacement, name: string, inside: 'a URL' | 'a title'): string {
  const plain = replacementAsPlainText(replacement);
  if (plain !== undefined) return plain;
  assertUnhandledCase(`{@ ${name} @} is inside ${inside} and takes only a string, text or a placeholder`);
}

/** Return `undefined` for a replacement that isn't plain text, such as a link or an HTML entity. */
function replacementAsPlainText(replacement: TemplateReplacement): string | undefined {
  if (typeof replacement === 'string' || typeof replacement === 'number' || typeof replacement === 'boolean') {
    return String(replacement);
  }
  if (isText(replacement)) return replacement.text;
  if (isKind(replacement, 'inline') && replacement.type === 'placeholder') return replacement.toString();
  return undefined;
}

/**
 * Convert a replacement for use inside frontmatter, as is: a string as written, and a Markdown element as rendered.
 * An HTML entity goes in as its character, since YAML doesn't read references.
 */
export function replacementAsFrontmatter(replacement: TemplateReplacement): string {
  if (typeof replacement === 'string' || typeof replacement === 'number' || typeof replacement === 'boolean') {
    return String(replacement);
  }
  if (isText(replacement)) return replacement.text;
  if (isHtmlEntity(replacement)) return replacement.character;
  // A replacement can be any kind. groupedNodes throws when a piece isn't Markdown content.
  if (!isArray(replacement)) return replacement.toString();
  return new MarkdownElement(
    'block',
    'fragment',
    'content',
    groupedNodes(replacement as AnyContent, 'frontmatter replacement'),
  ).toString();
}
