import { listPlaceholders } from '@streetsidesoftware/placeholders';
import type { List, ListItem, BlockContent as MdastBlockContent, PhrasingContent, RootContent, Text } from 'mdast';

import { asInlineHtml } from './inlineHtmlNode.ts';
import { placeholderNodeAsWritten } from './placeholderNode.ts';
import { renderNodes } from './render.ts';
import type { StyleOptions } from './render.ts';
import type {
  AnyContent,
  BlockContent,
  InlineContent,
  ListItemContent,
  MDBlock,
  MDElement,
  MDKind,
  MDListItem,
  MDText,
  MDType,
} from './types.ts';

/** Describes content on its own lines, where list items in a row form a list. */
type BlockLike = BlockContent | MDListItem | readonly (BlockContent | MDListItem)[];

/**
 * Holds the key an element's rendering is stored under. Having it is what makes a value a Markdown element.
 * It comes from the global symbol registry, so another loaded copy of this module recognizes the element too.
 */
const renderingKey: unique symbol = Symbol.for('@streetsidesoftware/markdown-toolkit.value');

/** Describes the nodes an element renders as, and the style to render them in. */
interface Rendering {
  nodes: RootContent[];
  style: StyleOptions | undefined;
}

/**
 * Implements every Markdown element. The public types are interfaces, so the node tree never appears in them.
 * The literal types of `kind` and `type` tell the public types apart.
 */
export class MarkdownElement<K extends MDKind = MDKind, T extends MDType = MDType> {
  readonly kind: K;
  readonly type: T;
  readonly description: string;

  constructor(kind: K, type: T, description: string, nodes: RootContent[], style?: StyleOptions) {
    this.kind = kind;
    this.type = type;
    this.description = description;
    // Set rather than declared: isolatedDeclarations rejects a computed key on a class.
    Object.assign(this, { [renderingKey]: { nodes, style } });
  }

  toString(): string {
    const { nodes, style } = renderingOf(this) ?? { nodes: [] };
    if (this.kind === 'inline') {
      return renderNodes([{ type: 'paragraph', children: nodes as PhrasingContent[] }], style);
    }
    if (this.kind === 'listItem') {
      return renderNodes([{ type: 'list', ordered: false, spread: false, children: nodes as ListItem[] }], style);
    }
    return renderNodes(nodes, style);
  }
}

/** Return how a Markdown element renders, or `undefined` for anything else. */
export function renderingOf(value: unknown): Rendering | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Partial<Record<typeof renderingKey, Rendering>>)[renderingKey]
    : undefined;
}

/** Check whether a value is a Markdown element, and of one of the given kinds. */
export function isKind(value: unknown, ...kinds: MDElement['kind'][]): value is MDElement {
  return renderingOf(value) !== undefined && kinds.includes((value as MDElement).kind);
}

/**
 * Return the text nodes for a string.
 * A placeholder is kept as written, so escaping never touches `{​@ name @​}`.
 */
export function textNodes(text: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
  let last = 0;
  for (const { start, end } of listPlaceholders(text)) {
    if (start > last) nodes.push({ type: 'text', value: text.slice(last, start) });
    nodes.push(placeholderNodeAsWritten(text.slice(start, end)));
    last = end;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

/**
 * Return the text nodes for a string, with each line ending as a line break.
 * The spaces and tabs around a line ending go with it, since they would show as `&#x20;` at the edge of a line.
 */
export function stringNodes(text: string): PhrasingContent[] {
  return text
    .split(/[ \t]*(?:\r\n?|\n)[ \t]*/)
    .flatMap((line, i): PhrasingContent[] => [...(i ? [{ type: 'break' } as const] : []), ...textNodes(line)]);
}

/**
 * Return the nodes for inline content.
 * @param where - what the content is for, such as `heading content`, for error messages.
 */
export function inlineNodes(content: InlineContent, where: string): PhrasingContent[] {
  if (typeof content === 'string') return stringNodes(content);
  if (isArray(content)) return content.flatMap((c) => inlineNodes(c, where));
  const rendering = renderingOf(content);
  // Inside a line, HTML such as a comment or `<br/>` is written as is, so a line ending before it stays.
  if (rendering && isKind(content, 'inline', 'comment')) return rendering.nodes.map(asInlineHtml);
  if (isListItem(content)) throw new TypeError(`${where} can't hold a list item; a list item goes in a list`);
  throw new TypeError(`${where} must be inline, got ${describe(content)}`);
}

/**
 * Return the nodes for block content. A list item stays on its own, for {@link inLists} to put in a list.
 * @param where - what the content is for, for error messages.
 */
export function blockNodes(content: BlockLike, where: string): RootContent[] {
  if (isArray(content)) return content.flatMap((c) => blockNodes(c, where));
  const rendering = renderingOf(content);
  if (rendering && isKind(content, 'block', 'comment', 'listItem')) return rendering.nodes;
  throw new TypeError(`${where} must be blocks, got ${describe(content)}`);
}

/** Check whether content is blocks: a block element, or a non-empty array of them. */
export function isBlockContent(content: unknown): content is BlockContent {
  if (Array.isArray(content)) return content.length > 0 && content.every(isBlockContent);
  return isKind(content, 'block');
}

/** Check whether content goes on its own lines: a block element, a list item, or a non-empty array of them. */
export function isBlockLike(content: unknown): content is BlockLike {
  if (Array.isArray(content)) return content.length > 0 && content.every(isBlockLike);
  return isKind(content, 'block', 'listItem');
}

/** Check whether a value is a list item made by `listItem`. */
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
  if (renderingOf(value)) return (value as MDElement).description;
  if (Array.isArray(value)) return 'an array';
  if (value === null || value === undefined) return String(value);
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/**
 * Map mixed content in order: the inline pieces between blocks as one paragraph each, and each block on its own.
 * Arrays are flattened, in the content and in what a mapper returns.
 */
export function mapParagraphsAndBlocks<T>(
  content: AnyContent | readonly AnyContent[],
  mapParagraph: (inline: InlineContent[]) => T | readonly T[],
  mapBlock: (block: MDBlock | MDListItem) => T | readonly T[],
): T[] {
  const result: (T | readonly T[])[] = [];
  let paragraph: InlineContent[] = [];
  function endParagraph(): void {
    if (paragraph.length) result.push(mapParagraph(paragraph));
    paragraph = [];
  }
  function add(piece: AnyContent | readonly AnyContent[]): void {
    if (isArray(piece)) {
      piece.forEach(add);
      return;
    }
    if (isBlockContent(piece) || isListItem(piece)) {
      endParagraph();
      result.push(mapBlock(piece));
      return;
    }
    paragraph.push(piece);
  }
  add(content);
  endParagraph();
  return result.flat() as T[];
}

/**
 * Return the blocks for mixed content: the inline pieces between blocks form a paragraph, blocks follow, and list
 * items form a list.
 * @param where - what the content is for, for error messages.
 */
export function groupedNodes(content: AnyContent | readonly AnyContent[], where: string): MdastBlockContent[] {
  const nodes = mapParagraphsAndBlocks(
    content,
    (inline): RootContent => ({ type: 'paragraph', children: inlineNodes(inline, where) }),
    (block) => blockNodes(block, where),
  );
  return inLists(nodes) as MdastBlockContent[];
}

/**
 * Return the blocks for the arguments of `document`, `listItem` or `details`, as {@link groupedNodes} does, but with
 * each argument on its own line:
 * - Inline arguments in a row form one paragraph, a line each. An array is one argument.
 * - Text loses the spaces and tabs at the start and end of an argument, and next to a block within one. They would show
 *   escaped next to a line ending.
 * - An argument that renders nothing leaves an empty line, so the arguments around it are two paragraphs.
 * @param where - what the content is for, for error messages.
 */
export function argumentNodes(args: readonly AnyContent[], where: string): MdastBlockContent[] {
  const nodes: RootContent[] = [];
  let lines: PhrasingContent[][] = [];
  function endParagraph(): void {
    if (lines.length) nodes.push({ type: 'paragraph', children: joinLines(lines) });
    lines = [];
  }
  for (const arg of args) {
    const parts = mapParagraphsAndBlocks<{ inline: InlineContent[] } | { block: MDBlock | MDListItem }>(
      arg,
      (inline) => ({ inline }),
      (block) => ({ block }),
    );
    if (!parts.length) endParagraph();
    for (const part of parts) {
      if ('block' in part) {
        endParagraph();
        for (const node of blockNodes(part.block, where)) nodes.push(node);
        continue;
      }
      const line = trimBlanks(inlineNodes(part.inline, where));
      if (line.length) lines.push(line);
      else endParagraph();
    }
  }
  endParagraph();
  return inLists(nodes) as MdastBlockContent[];
}

/** Join lines with a line ending, except next to a line break, which already ends the line. */
function joinLines(lines: readonly PhrasingContent[][]): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  for (const line of lines) {
    const before = result.at(-1);
    if (before && before.type !== 'break' && line[0].type !== 'break') result.push({ type: 'text', value: '\n' });
    for (const node of line) result.push(node);
  }
  return result;
}

/** Return the inline nodes without the spaces and tabs at their start and end. Text left empty is dropped. */
function trimBlanks(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  const result = [...nodes];
  while (result[0]?.type === 'text') {
    const value = result[0].value.replace(/^[ \t]+/, '');
    if (value) {
      result[0] = { ...result[0], value };
      break;
    }
    result.shift();
  }
  while (result.at(-1)?.type === 'text') {
    const last = result.at(-1) as Text;
    const value = last.value.replace(/[ \t]+$/, '');
    if (value) {
      result[result.length - 1] = { ...last, value };
      break;
    }
    result.pop();
  }
  return result;
}

/**
 * Put each run of list items in a bullet list. A run joins a list right before or after it, so a list item next to a
 * list is one more item of it, and the list keeps its numbering. Two lists in a row stay two lists.
 */
export function inLists(nodes: readonly RootContent[]): RootContent[] {
  const result: RootContent[] = [];
  let joined: List | undefined;
  let joinedBefore = false;
  for (const node of nodes) {
    if (node.type === 'listItem') {
      if (!joined) {
        const before = result.at(-1)?.type === 'list' ? (result.pop() as List) : undefined;
        joined = { type: 'list', ordered: false, spread: false, ...before, children: [...(before?.children ?? [])] };
        joinedBefore = before !== undefined;
        result.push(joined);
      }
      joined.children.push(node);
      continue;
    }
    if (joined && node.type === 'list') {
      // With no list before them, the list items join this one as its first items, so it keeps its own settings.
      if (!joinedBefore) Object.assign(joined, { ...node, children: joined.children });
      for (const item of node.children) joined.children.push(item);
      joined = undefined;
      continue;
    }
    joined = undefined;
    result.push(node);
  }
  return result;
}

/** Build a list item from its arguments, grouped as in {@link argumentNodes}. */
export function listItemNode(content: readonly ListItemContent[]): ListItem {
  return { type: 'listItem', spread: false, children: argumentNodes(content, 'list item content') };
}
