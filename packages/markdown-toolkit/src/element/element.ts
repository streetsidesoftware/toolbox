import type { ListItem, PhrasingContent, RootContent } from 'mdast';

import { renderNodes } from '../render.ts';
import type { MarkdownStyle, MDElement, MDKind, MDListItem, MDText, MDType } from '../types.ts';

/**
 * The key an element's internals are stored under. Having it is what makes a value a Markdown element.
 * It comes from the global symbol registry, so another loaded copy of this module recognizes the element too.
 */
const markdownInternalsKey: unique symbol = Symbol.for('@streetsidesoftware/markdown-toolkit.value');

/** The non-public side of a Markdown element. */
interface MarkdownInternals {
  nodes: RootContent[];
  style: MarkdownStyle | undefined;
}

/**
 * Implements every Markdown element. The public types are interfaces, so the node tree never appears in them.
 * The literal types of `kind` and `type` tell the public types apart.
 */
export class MarkdownElement<K extends MDKind = MDKind, T extends MDType = MDType> {
  readonly kind: K;
  readonly type: T;
  readonly description: string;

  constructor(kind: K, type: T, description: string, nodes: RootContent[], style?: MarkdownStyle) {
    this.kind = kind;
    this.type = type;
    this.description = description;
    // Set rather than declared: isolatedDeclarations rejects a computed key on a class.
    Object.assign(this, { [markdownInternalsKey]: { nodes, style } });
  }

  // Takes no options: a template literal passes no arguments.
  toString(): string {
    const { nodes, style } = markdownInternalsOf(this);
    if (this.kind === 'inline') {
      return renderNodes([{ type: 'paragraph', children: nodes as PhrasingContent[] }], style);
    }
    if (this.kind === 'listItem') {
      return renderNodes([{ type: 'list', ordered: false, spread: false, children: nodes as ListItem[] }], style);
    }
    return renderNodes(nodes, style);
  }
}

/** Return a Markdown element's internals, or `undefined` for anything else. */
export function markdownInternalsOf(element: MDElement): MarkdownInternals;
export function markdownInternalsOf(value: unknown): MarkdownInternals | undefined;
export function markdownInternalsOf(value: unknown): MarkdownInternals | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Partial<Record<typeof markdownInternalsKey, MarkdownInternals>>)[markdownInternalsKey]
    : undefined;
}

/** Check whether a value is a Markdown element, and of one of the given kinds. */
export function isKind(value: unknown, ...kinds: MDElement['kind'][]): value is MDElement {
  return isMDElement(value) && kinds.includes(value.kind);
}

/** Check whether a value is a list item. */
export function isListItem(value: unknown): value is MDListItem {
  return isKind(value, 'listItem');
}

/** Check whether a value is text made by `text` or `inlineText`. */
export function isText(value: unknown): value is MDText {
  return isKind(value, 'inline') && value.type === 'text';
}

/** Check whether a value is an array, as `Array.isArray` does, but narrowing readonly arrays too. */
export function isArray<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}

/** Describe what a value is, for error messages. */
export function describe(value: unknown): string {
  if (isMDElement(value)) return value.description;
  if (Array.isArray(value)) return 'an array';
  if (value === null || value === undefined) return String(value);
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/**
 * Check whether a value is an element made by this library, such as a paragraph or a link.
 *
 * @example
 * md.isMDElement(md.p('Hi'));
 * // true
 * md.isMDElement('Hi');
 * // false
 * @category elements
 */
export function isMDElement(value: unknown): value is MDElement {
  return typeof value === 'object' && value !== null && markdownInternalsKey in value;
}
