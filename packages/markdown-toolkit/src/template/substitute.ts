import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';

import { DocumentElement, isHtmlEntity, text } from '../builder/index.ts';
import { blockNodes, describe, inLists, isBlockLike, isText, MarkdownElement, renderingOf } from '../element/index.ts';
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
import { resolverOf, valueAsCode, valueAsFrontmatter, valueAsInline, valueInLink } from './values.ts';
import type { TemplateResolver, TemplateValues } from './values.ts';

/**
 * Substitute values for the `{​@ name @​}` placeholders in an existing element, such as a parsed file, or in plain text.
 *
 * When the first argument is a string, its Markdown and HTML show as text, not as formatting, and each newline is a
 * line break. For a string that's already Markdown, use {@link template}.
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
  values: TemplateValues | TemplateResolver,
): MDText | MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDInlineFragment,
  values: TemplateValues | TemplateResolver,
): MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDParagraph,
  values: TemplateValues | TemplateResolver,
): MDParagraph | MDFragment;

export function substitutePlaceholders(
  content: MDPlaceholder,
  values: TemplateValues | TemplateResolver,
): MDPlaceholder | MDInlineFragment | MDFragment;

export function substitutePlaceholders(
  content: MDBlockPlaceholder,
  values: TemplateValues | TemplateResolver,
): MDBlockPlaceholder | MDFragment;

export function substitutePlaceholders(
  content: MDInline,
  values: TemplateValues | TemplateResolver,
): MDInline | MDFragment;

export function substitutePlaceholders<T extends MDElement>(content: T, values: TemplateValues | TemplateResolver): T;

export function substitutePlaceholders(
  content: MDElement | string,
  values: TemplateValues | TemplateResolver,
): MDElement {
  if (typeof content === 'string') return substitutePlaceholders(text(content), values);
  const resolve = resolverOf(values);
  const rendering = renderingOf(content);
  if (!rendering) throw new TypeError(`expected a string or a Markdown element, got ${describe(content)}`);
  // An HTML entity has no placeholder in it, and keeps its character.
  if (isHtmlEntity(content)) return content;
  const substituted = isText(content) ? substituteInText(content.text, resolve) : undefined;
  if (substituted !== undefined) return text(substituted);
  const { style } = rendering;
  const nodes = structuredClone(rendering.nodes);
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

/** Return a tree of the nodes, with the placeholders that have values replaced. */
function substitutedTree(nodes: RootContent[], resolve: TemplateResolver, allowBlocks: boolean): Root {
  const root: Root = { type: 'root', children: nodes };
  substituteInTree(root, resolve, allowBlocks);
  return root;
}

/**
 * Return the text with its placeholders substituted, or `undefined` if a value isn't a string or text.
 * A placeholder with no value is kept as written.
 */
function substituteInText(text: string, resolve: TemplateResolver): string | undefined {
  let onlyText = true;
  const result = replacePlaceholders(text, (name: string) => {
    const value = resolve(name);
    if (value === undefined) return undefined;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (isText(value)) return value.text;
    onlyText = false;
    return undefined;
  });
  return onlyText ? result : undefined;
}

/** Holds the blocks in place of a placeholder that is a whole line, until its paragraph is split around them. */
interface BlockSlot {
  readonly blocks: RootContent[];
}

/** Holds the place of a placeholder whose value shows nothing, until its paragraph is rebuilt. */
interface EmptySlot {
  readonly empty: true;
}

type Piece = RootContent | BlockSlot | EmptySlot;

/** Describes a paragraph being substituted: one that can split around blocks, or one that has to stay whole. */
type ParagraphMode = 'split' | 'join';

/** Lists the node types whose children may be blocks. */
const blockContainers = new Set(['blockquote', 'footnoteDefinition', 'list', 'listItem']);

/**
 * Replace the placeholders that have values, in place.
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
      const value = resolve(name);
      if (value === undefined) return [node];
      const wholeLine = paragraph !== undefined && isWholeLine(nodes, i);
      if (paragraph === 'split' && wholeLine && isBlockLike(value)) {
        return [{ blocks: blockNodes(value, `{@ ${name} @}`) }];
      }
      const inline = valueAsInline(value, name);
      // On a line of its own, a value is trimmed as an argument is.
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
          const value = resolve(name);
          return value === undefined ? undefined : valueAsFrontmatter(value);
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
          // A list's children are its items already; any other block container may get list items from values.
          const grouped = blockChildren && node.type !== 'list' ? inLists(children as RootContent[]) : children;
          node.children = grouped as typeof node.children;
        }
        return [node];
    }
  });
}

function substituteInCode(code: string, resolve: TemplateResolver, inside: 'code' | 'HTML'): string {
  return replacePlaceholders(code, (name: string) => {
    const value = resolve(name);
    return value === undefined ? undefined : valueAsCode(value, name, inside);
  });
}

function substituteInLink(urlOrTitle: string, resolve: TemplateResolver, inside: 'a URL' | 'a title'): string {
  return replacePlaceholders(urlOrTitle, (name: string) => {
    const value = resolve(name);
    return value === undefined ? undefined : valueInLink(value, name, inside);
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
 * Return a paragraph's pieces without the lines that values showing nothing left empty, as passing the values
 * directly would: where the paragraph can split, such a line ends it; otherwise the line goes, with its line ending.
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

/** Describes one line of a paragraph's pieces. */
interface PieceLine {
  readonly pieces: Piece[];
  /** Holds the text of the line ending after the line, if it isn't a line break. */
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

/** Check whether a line holds a value that shows nothing, and nothing else but spaces and tabs. */
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
