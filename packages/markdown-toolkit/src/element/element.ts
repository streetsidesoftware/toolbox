import { listNode, paragraphNode } from '../mdast/index.ts';
import type { ListItem, PhrasingContent, RootContent } from '../mdast/index.ts';
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
      return renderNodes([paragraphNode(nodes as PhrasingContent[])], style);
    }
    if (this.kind === 'listItem') {
      return renderNodes([listNode(nodes as ListItem[])], style);
    }
    return renderNodes(nodes, style);
  }
}

/**
 * Return an element's internals.
 * Check a value from a caller with {@link assertIsMDElement} or {@link isMDElement} first:
 * an object that only looks like an element has none.
 */
export function markdownInternalsOf(element: MDElement): MarkdownInternals {
  return (element as unknown as Record<typeof markdownInternalsKey, MarkdownInternals>)[markdownInternalsKey];
}

/** Throw a `TypeError` unless the value is a Markdown element. `expected` names what the caller may pass. */
export function assertIsMDElement(value: unknown, expected: string): asserts value is MDElement {
  if (!isMDElement(value)) throw new TypeError(`expected ${expected}`);
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

/** Throw a `TypeError` unless the condition holds. `message` says what was expected and what was given. */
export function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

/** Throw a `TypeError` for a value that no case accepted. `message` states what is expected. */
export function assertUnhandledCase(message: string): never {
  throw new TypeError(message);
}

/** Throw a `TypeError` unless the value is an array. `what` names the value, such as `table header`. */
export function assertIsArray<T>(value: T | readonly T[], what: string): asserts value is readonly T[] {
  if (!isArray(value)) throw new TypeError(`${what} must be an array`);
}

/** Check whether a value is an array, as `Array.isArray` does, but narrowing readonly arrays too. */
export function isArray<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
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
