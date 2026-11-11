import { listPlaceholders } from '@streetsidesoftware/placeholders';
import type { List, BlockContent as MdastBlockContent, PhrasingContent, RootContent } from 'mdast';

import { asInlineHtml, placeholderNodeAsWritten, trimBlanks } from '../mdast/index.ts';
import type { AnyContent, BlockContent, InlineContent, MDBlock, MDListItem } from '../types.ts';
import { assertCondition, assertUnhandledCase, isArray, isKind, isListItem, markdownInternalsOf } from './element.ts';

/** Content on its own lines, where list items in a row form a list. */
type BlockLike = BlockContent | MDListItem | readonly (BlockContent | MDListItem)[];

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

/** Return the text nodes for a string, with each line ending as a line break. */
export function stringNodes(text: string): PhrasingContent[] {
  return text
    .split(/\r\n?|\n/)
    .flatMap((line, i): PhrasingContent[] => [...(i ? [{ type: 'break' } as const] : []), ...textNodes(line)]);
}

/**
 * Return the nodes for inline content.
 * @param where - what the content is for, such as `heading content`, for error messages.
 */
export function inlineNodes(content: InlineContent, where: string): PhrasingContent[] {
  if (typeof content === 'string') return stringNodes(content);
  if (isArray(content)) return content.flatMap((c) => inlineNodes(c, where));
  // Inside a line, HTML such as a comment or `<br/>` is written as is, so a line ending before it stays.
  if (isKind(content, 'inline')) return markdownInternalsOf(content).nodes.map(asInlineHtml);
  assertCondition(!isListItem(content), `${where} can't hold a list item; a list item goes in a list`);
  assertUnhandledCase(`${where} must be inline`);
}

/**
 * Return the nodes for block content. A list item stays on its own, for {@link inLists} to put in a list.
 * @param where - what the content is for, for error messages.
 */
export function blockNodes(content: BlockLike, where: string): RootContent[] {
  if (isArray(content)) return content.flatMap((c) => blockNodes(c, where));
  if (isKind(content, 'block', 'listItem')) return markdownInternalsOf(content).nodes;
  assertUnhandledCase(`${where} must be blocks`);
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
