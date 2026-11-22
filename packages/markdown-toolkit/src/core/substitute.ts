import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { Paragraph, PhrasingContent, RootContent, Text } from 'mdast';

import { trimBlanks } from './blanks.ts';
import { inLists } from './lists.ts';
import { paragraphNode } from './nodes.ts';
import type { PlaceholderNode } from './placeholderNode.ts';

/** The replacements for placeholders, each in the form that its place in the nodes takes. */
export interface PlaceholderReplacements {
  /**
   * Return the replacement for a placeholder alone on a line where blocks can go, or `undefined` to keep the placeholder.
   * Blocks split the paragraph around them, and other nodes stay in its line.
   */
  line(name: string): { readonly blocks: RootContent[] } | PhrasingContent[] | undefined;
  /** Return the nodes for a placeholder elsewhere inside a line, or `undefined` to keep the placeholder. */
  inline(name: string): PhrasingContent[] | undefined;
  /** Return the string for a placeholder in a place that takes only a string, or `undefined` to keep it. */
  string(name: string, inside: StringPlace): string | undefined;
}

/** A place that takes only a string. Most names read as a phrase, such as `a URL`, for error messages. */
type StringPlace = 'code' | 'HTML' | 'a URL' | 'a title' | 'frontmatter';

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
 * - `join`: the paragraph stays whole. Only nodes that go inside a line can replace the placeholder, and an empty line is
 *   removed.
 */
type ParagraphMode = 'split' | 'join';

/** The node types inside which a placeholder alone on a line of a paragraph can take blocks, if every node above is one too. */
const blockContainers = new Set(['blockquote', 'footnoteDefinition', 'htmlBlockSlot', 'htmlGroup', 'list', 'listItem']);

/**
 * Return the nodes with each placeholder that has a replacement replaced by it.
 * It changes the nodes it's given, so pass a copy to keep the originals.
 * - A placeholder is a node of its own. In code, HTML, a URL, a title and frontmatter, it's part of the string.
 * - Where blocks can go, a placeholder that is a whole line of a paragraph may take blocks.
 *   The paragraph splits around them.
 * @param blocks - the nodes may be blocks.
 */
export function substituteNodes(
  nodes: RootContent[],
  replacements: PlaceholderReplacements,
  blocks: boolean,
): RootContent[] {
  return inLists(substituteInNodes(nodes, replacements, undefined, blocks) as RootContent[]);
}

/**
 * @param paragraph - the nodes are a paragraph's children, and whether the paragraph can split.
 * @param blocks - the nodes may be blocks.
 */
function substituteInNodes(
  nodes: RootContent[],
  replacements: PlaceholderReplacements,
  paragraph: ParagraphMode | undefined,
  blocks: boolean,
): Piece[] {
  return nodes.flatMap((node, i): Piece[] => {
    if (node.type === 'inlineHtml') {
      node.value = substituteInString(node.value, replacements, 'HTML');
      return [node];
    }
    if (node.type === 'placeholder') {
      const name = placeholderName(node);
      const wholeLine = paragraph !== undefined && isWholeLine(nodes, i);
      const replacement = paragraph === 'split' && wholeLine ? replacements.line(name) : replacements.inline(name);
      if (replacement === undefined) return [node];
      if ('blocks' in replacement) return [replacement];
      // Spaces and tabs at the ends of a line would show escaped next to its line ending.
      const shown = wholeLine ? trimBlanks(replacement) : replacement;
      return shown.length || !paragraph ? shown : [{ empty: true }];
    }
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      node.url = substituteInString(node.url, replacements, 'a URL');
      if (node.title) node.title = substituteInString(node.title, replacements, 'a title');
    }
    switch (node.type) {
      case 'paragraph': {
        const mode = blocks ? 'split' : 'join';
        const pieces = substituteInNodes(node.children, replacements, mode, false);
        return splitParagraph(node, withoutEmptiedLines(pieces, mode));
      }
      case 'yaml':
        node.value = substituteInString(node.value, replacements, 'frontmatter');
        return [node];
      case 'html':
        node.value = substituteInString(node.value, replacements, 'HTML');
        return [node];
      case 'inlineCode':
      case 'code':
        node.value = substituteInString(node.value, replacements, 'code');
        return [node];
      default:
        if ('children' in node) {
          const blockChildren = blocks && blockContainers.has(node.type);
          const children = substituteInNodes(node.children, replacements, undefined, blockChildren);
          // A list's children are its items already; any other block container may get list items from replacements.
          const grouped = blockChildren && node.type !== 'list' ? inLists(children as RootContent[]) : children;
          node.children = grouped as typeof node.children;
        }
        return [node];
    }
  });
}

function substituteInString(value: string, replacements: PlaceholderReplacements, inside: StringPlace): string {
  return replacePlaceholders(value, (name: string) => replacements.string(name, inside));
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
    for (const block of piece.blocks) result.push(block);
  }
  endParagraph();
  return result;

  function endParagraph(): void {
    const children = trimLine(line);
    if (children.length) result.push(paragraphNode(children));
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
