import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';

import { DocumentElement, isHtmlEntity, text } from '../builder/index.ts';
import {
  assertIsMDElement,
  blockNodes,
  inLists,
  isBlockLike,
  isText,
  MarkdownElement,
  markdownInternalsOf,
} from '../element/index.ts';
import { trimBlanks } from '../mdast/index.ts';
import type { PlaceholderNode } from '../mdast/index.ts';
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
import {
  replacementAsCode,
  replacementAsFrontmatter,
  replacementAsInline,
  replacementInLink,
  resolverOf,
} from './replacements.ts';
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
  switch (content.type) {
    case 'text':
    case 'inlineFragment':
      return fragmentOf(
        substitutedTree([{ type: 'paragraph', children: nodes as PhrasingContent[] }], resolve, true),
        style,
      );
    case 'paragraph': {
      const root = substitutedTree(nodes, resolve, true);
      if (root.children.length === 1 && root.children[0].type === 'paragraph') {
        return new MarkdownElement('block', 'paragraph', 'a paragraph', root.children, style);
      }
      return new MarkdownElement('block', 'fragment', 'a Markdown fragment', root.children, style);
    }
    case 'placeholder':
      if (resolve((content as MDPlaceholder).name) === undefined) return content;
      return fragmentOf(
        substitutedTree([{ type: 'paragraph', children: nodes as PhrasingContent[] }], resolve, true),
        style,
      );
    case 'blockPlaceholder':
      if (resolve((content as MDBlockPlaceholder).name) === undefined) return content;
      return new MarkdownElement(
        'block',
        'fragment',
        'a Markdown fragment',
        substitutedTree(nodes, resolve, true).children,
        style,
      );
    case 'document':
      return new DocumentElement(substitutedTree(nodes, resolve, true).children, style);
    default:
      return new MarkdownElement(
        content.kind,
        content.type,
        content.description,
        substitutedTree(nodes, resolve, content.kind !== 'inline').children,
        style,
      );
  }
}

/** Return a tree of the nodes, with each placeholder that has a replacement replaced by it. */
function substitutedTree(nodes: RootContent[], resolve: TemplateResolver, allowBlocks: boolean): Root {
  const root: Root = { type: 'root', children: nodes };
  substituteInTree(root, resolve, allowBlocks);
  return root;
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

/** Where a paragraph splits: the blocks that replace a placeholder on a line of its own, or none where replacements left a line empty. */
interface BlockSlot {
  readonly blocks: RootContent[];
}

/** Stands in for a placeholder whose replacement shows nothing, until its paragraph is rebuilt. */
interface EmptySlot {
  readonly empty: true;
}

type Piece = RootContent | BlockSlot | EmptySlot;

/**
 * What a paragraph does with a placeholder alone on a line, when its replacement is a block or empty:
 * - `split`: the paragraph splits at that line, around any block.
 * - `join`: the paragraph stays whole. A block is an error, and an empty line is removed.
 */
type ParagraphMode = 'split' | 'join';

/** The node types inside which a placeholder alone on a line of a paragraph can take blocks, if every node above is one too. */
const blockContainers = new Set(['blockquote', 'footnoteDefinition', 'htmlBlockSlot', 'htmlGroup', 'list', 'listItem']);

/**
 * Replace the placeholders that have replacements, in place.
 * - A placeholder is a node of its own. In code and HTML, it's part of the text.
 * - Where blocks can go, a placeholder that is a whole line of a paragraph may take blocks.
 *   The paragraph splits around them.
 * @param allowBlocks - the root's children may be blocks.
 */
export function substituteInTree(root: Root, resolve: TemplateResolver, allowBlocks: boolean): void {
  root.children = inLists(substituteInNodes(root.children, resolve, undefined, allowBlocks) as RootContent[]);
}

/**
 * @param paragraph - the nodes are a paragraph's children, and whether the paragraph can split.
 * @param blocks - the nodes may be blocks.
 */
function substituteInNodes(
  nodes: RootContent[],
  resolve: TemplateResolver,
  paragraph: ParagraphMode | undefined,
  blocks: boolean,
): Piece[] {
  return nodes.flatMap((node, i): Piece[] => {
    if (node.type === 'inlineHtml') {
      node.value = substituteInCode(node.value, resolve, 'HTML');
      return [node];
    }
    if (node.type === 'placeholder') {
      const name = placeholderName(node);
      const replacement = resolve(name);
      if (replacement === undefined) return [node];
      const wholeLine = paragraph !== undefined && isWholeLine(nodes, i);
      if (paragraph === 'split' && wholeLine && isBlockLike(replacement)) {
        return [{ blocks: blockNodes(replacement, `{@ ${name} @}`) }];
      }
      const inline = replacementAsInline(replacement, name);
      // On a line of its own, a replacement is trimmed as an argument is.
      const shown = wholeLine ? trimBlanks(inline) : inline;
      return shown.length || !paragraph ? shown : [{ empty: true }];
    }
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      node.url = substituteInLink(node.url, resolve, 'a URL');
      if (node.title) node.title = substituteInLink(node.title, resolve, 'a title');
    }
    switch (node.type) {
      case 'paragraph': {
        const mode = blocks ? 'split' : 'join';
        return splitParagraph(node, withoutEmptiedLines(substituteInNodes(node.children, resolve, mode, false), mode));
      }
      case 'yaml':
        node.value = replacePlaceholders(node.value, (name: string) => {
          const replacement = resolve(name);
          return replacement === undefined ? undefined : replacementAsFrontmatter(replacement);
        });
        return [node];
      case 'html':
        node.value = substituteInCode(node.value, resolve, 'HTML');
        return [node];
      case 'inlineCode':
      case 'code':
        node.value = substituteInCode(node.value, resolve, 'code');
        return [node];
      default:
        if ('children' in node) {
          const blockChildren = blocks && blockContainers.has(node.type);
          const children = substituteInNodes(node.children, resolve, undefined, blockChildren);
          // A list's children are its items already; any other block container may get list items from replacements.
          const grouped = blockChildren && node.type !== 'list' ? inLists(children as RootContent[]) : children;
          node.children = grouped as typeof node.children;
        }
        return [node];
    }
  });
}

function substituteInCode(code: string, resolve: TemplateResolver, inside: 'code' | 'HTML'): string {
  return replacePlaceholders(code, (name: string) => {
    const replacement = resolve(name);
    return replacement === undefined ? undefined : replacementAsCode(replacement, name, inside);
  });
}

function substituteInLink(urlOrTitle: string, resolve: TemplateResolver, inside: 'a URL' | 'a title'): string {
  return replacePlaceholders(urlOrTitle, (name: string) => {
    const replacement = resolve(name);
    return replacement === undefined ? undefined : replacementInLink(replacement, name, inside);
  });
}

/** Rebuild a paragraph from its children after substitution, split around the blocks among them. */
function splitParagraph(paragraph: Paragraph, pieces: Piece[]): RootContent[] {
  if (!pieces.some(isBlockSlot)) {
    paragraph.children = pieces as PhrasingContent[];
    return [paragraph];
  }
  const result: RootContent[] = [];
  let line: PhrasingContent[] = [];
  for (const piece of pieces) {
    if (!isBlockSlot(piece)) {
      line.push(piece as PhrasingContent);
      continue;
    }
    endParagraph();
    result.push(...piece.blocks);
  }
  endParagraph();
  return result;

  function endParagraph(): void {
    const children = trimLine(line);
    if (children.length) result.push({ type: 'paragraph', children });
    line = [];
  }
}

function isBlockSlot(piece: Piece): piece is BlockSlot {
  return 'blocks' in piece;
}

/**
 * Return a paragraph's pieces without the lines that replacements showing nothing left empty, as passing the
 * replacements directly would: where the paragraph can split, such a line ends it; otherwise the line goes, with its
 * line ending.
 */
function withoutEmptiedLines(pieces: readonly Piece[], mode: ParagraphMode): Piece[] {
  if (!pieces.some(isEmptySlot)) return [...pieces];
  const lines = piecesByLine(pieces);
  const result: Piece[] = [];
  // How many pieces at the end of the result are the line ending of the line before.
  let ending = 0;
  lines.forEach((line, i) => {
    if (!isEmptiedLine(line.pieces)) {
      for (const piece of line.pieces) if (!isEmptySlot(piece)) result.push(piece);
      for (const piece of line.ending) result.push(piece);
      ending = line.ending.length;
      return;
    }
    if (mode === 'split') {
      result.push({ blocks: [] });
      ending = 0;
      return;
    }
    // The last line has no line ending of its own to go with it, so the one before it goes.
    if (i === lines.length - 1) result.length -= ending;
    ending = 0;
  });
  return result;
}

interface PieceLine {
  readonly pieces: Piece[];
  /** The line ending after the line, as text. It's empty after a line break or at the paragraph's end. */
  readonly ending: Piece[];
}

/** Split a paragraph's pieces into lines, at each line ending in text and after each line break. */
function piecesByLine(pieces: readonly Piece[]): PieceLine[] {
  const lines: PieceLine[] = [{ pieces: [], ending: [] }];
  for (const piece of pieces) {
    if (!isTextPiece(piece)) {
      lines[lines.length - 1].pieces.push(piece);
      if (!isBlockSlot(piece) && !isEmptySlot(piece) && piece.type === 'break') lines.push({ pieces: [], ending: [] });
      continue;
    }
    const { value } = piece;
    let start = 0;
    for (let i = 0; i < value.length; ++i) {
      if (value[i] !== '\r' && value[i] !== '\n') continue;
      const end = value[i] === '\r' && value[i + 1] === '\n' ? i + 2 : i + 1;
      const line = lines[lines.length - 1];
      if (i > start) line.pieces.push({ ...piece, value: value.slice(start, i) });
      line.ending.push({ ...piece, value: value.slice(i, end) });
      lines.push({ pieces: [], ending: [] });
      start = end;
      i = end - 1;
    }
    if (start < value.length) lines[lines.length - 1].pieces.push({ ...piece, value: value.slice(start) });
  }
  return lines;
}

/** Check whether a line holds a replacement that shows nothing, and nothing else but spaces and tabs. */
function isEmptiedLine(pieces: readonly Piece[]): boolean {
  return pieces.some(isEmptySlot) && pieces.every((piece) => isEmptySlot(piece) || isBlankText(piece));
}

function isEmptySlot(piece: Piece): piece is EmptySlot {
  return 'empty' in piece;
}

function isTextPiece(piece: Piece): piece is Text {
  return !isBlockSlot(piece) && !isEmptySlot(piece) && piece.type === 'text';
}

function isBlankText(piece: Piece): boolean {
  if (!isTextPiece(piece)) return false;
  for (const c of piece.value) if (c !== ' ' && c !== '\t') return false;
  return true;
}

/** Return the inline nodes without the line endings at their start and end. */
function trimLine(nodes: PhrasingContent[]): PhrasingContent[] {
  const result = nodes.filter((node, i) => node.type !== 'break' || (i > 0 && i < nodes.length - 1));
  const first = result[0];
  if (first?.type === 'text') result[0] = { ...first, value: first.value.replace(/^[ \t]*\r?\n/, '') };
  const last = result.at(-1);
  if (last?.type === 'text') result[result.length - 1] = { ...last, value: last.value.replace(/\r?\n[ \t]*$/, '') };
  return result.filter((node) => node.type !== 'text' || node.value);
}

/** Check whether the node at `i` has nothing else on its line. */
function isWholeLine(nodes: readonly RootContent[], i: number): boolean {
  return endsLine(nodes[i - 1], /\n[ \t]*$/) && endsLine(nodes[i + 1], /^[ \t]*\r?\n/);
}

/** Check whether a neighbor ends the line at its side: there is none, or it's a line break. */
function endsLine(node: RootContent | undefined, lineEnd: RegExp): boolean {
  return !node || node.type === 'break' || (node.type === 'text' && lineEnd.test(node.value));
}

function placeholderName(node: PlaceholderNode): string {
  const [first] = listPlaceholders(node.value);
  return first.name;
}
