import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { trimBlanks } from './blanks.ts';
import { text } from './builders.ts';
import { detectMarkdownStyle } from './detectStyle.ts';
import { DocumentElement } from './documentElement.ts';
import { readFrontmatter, yamlNode } from './frontmatter.ts';
import { isHtmlEntity } from './htmlEntity.ts';
import { asInlineHtmlNode } from './inlineHtmlNode.ts';
import {
  blockNodes,
  describe,
  groupedNodes,
  inlineNodes,
  inLists,
  isArray,
  isBlockLike,
  isKind,
  isText,
  MarkdownElement,
  renderingOf,
  textNodes,
} from './nodes.ts';
import { asPlaceholderNode, placeholderNodeAsWritten } from './placeholderNode.ts';
import type { PlaceholderNode } from './placeholderNode.ts';
import type { StyleOptions } from './render.ts';
import type {
  AnyContent,
  InlineContent,
  MDBlockPlaceholder,
  MDDocument,
  MDElement,
  MDFragment,
  MDInline,
  MDInlineFragment,
  MDParagraph,
  MDPlaceholder,
  MDText,
} from './types.ts';

/** Describes a value a template placeholder can take. */
export type TemplateValue = string | number | boolean | MDElement | readonly TemplateValue[];

/**
 * Holds the values for a template, by placeholder name.
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

/**
 * Create Markdown from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * - A string value shows as text, not as formatting, with each newline as a line break.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string or an {@link htmlEntity}. A string goes in as given. An
 *   entity shows as its character in code, and as its reference in HTML.
 * - A placeholder in a link's URL or title takes only a string, which goes in as given.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * A result of one paragraph can go anywhere a string can. A longer one goes where paragraphs can.
 *
 * @param values - by placeholder name, or a {@link TemplateResolver}. In an object, a dotted name, such as
 *   `engines.cspell`, reaches into a nested object.
 * @example
 * md.template('Install {@name@} with npm.', { name: 'cspell' });
 * // Install cspell with npm.
 * @category templates
 */
export function template(markdown: string, values: TemplateValues | TemplateResolver): MDFragment | MDInlineFragment {
  const root = templateTree(markdown, false);
  substituteInTree(root, resolverOf(values), true);
  return fragment(root, markdown);
}

/**
 * Create paragraphs and other blocks from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * - A string value shows as text, not as formatting, with each newline as a line break.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string or an {@link htmlEntity}. A string goes in as given. An
 *   entity shows as its character in code, and as its reference in HTML.
 * - A placeholder in a link's URL or title takes only a string, which goes in as given.
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
  substituteInTree(root, resolverOf(values), true);
  return new MarkdownElement(
    'block',
    'fragment',
    'a Markdown fragment',
    root.children,
    detectMarkdownStyle(root, markdown),
  );
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
 * Parse Markdown text so it can be added to a page with its formatting.
 *
 * Text of one paragraph can go anywhere a string can, even in a heading.
 * Longer text goes where paragraphs can, such as in a document or a list item.
 *
 * @example
 * md.parse('Some **bold** text.');
 * // The page shows "Some bold text." with "bold" in bold.
 * @category text
 */
export function parse(markdown: string): MDFragment | MDInlineFragment {
  const root = parseTree(markdown, false);
  keepPlaceholders(root);
  return fragment(root, markdown);
}

/**
 * Parse a whole Markdown file, frontmatter included.
 *
 * Its frontmatter, formatting and `{​@ name @​}` placeholders stay as they are, ready for {@link substitutePlaceholders}.
 *
 * @example
 * md.parseDocument('# Title\n\n* item\n');
 * // # Title
 * //
 * // * item
 * @category documents
 */
export function parseDocument(markdown: string): MDDocument {
  return documentOf(markdown, (body) => {
    const root = parseTree(body, false);
    keepPlaceholders(root);
    return root;
  });
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
 * - A placeholder in a link's URL or title takes only a string, which goes in as given.
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
 * - A placeholder in a link's URL or title takes only a string, which goes in as given.
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

/** Read a whole file as a document, its body by `read`, with values substituted when there are any. */
function documentOf(markdown: string, read: (body: string) => Root, resolve?: TemplateResolver): MDDocument {
  const front = readFrontmatter(markdown);
  const body = front ? markdown.slice(front.end) : markdown;
  const root = read(body);
  const style = detectMarkdownStyle(root, body);
  if (front) root.children.unshift(yamlNode(front.yaml));
  if (resolve) substituteInTree(root, resolve, true);
  return new DocumentElement(root.children, style);
}

/** Return a parsed tree as an element, in the style of its text. */
function fragment(root: Root, markdown: string): MDFragment | MDInlineFragment {
  return fragmentOf(root, detectMarkdownStyle(root, markdown));
}

/** Return a tree as an element. A single paragraph is inline, and anything else is blocks. */
function fragmentOf(root: Root, style: StyleOptions | undefined): MDFragment | MDInlineFragment {
  const [only, ...rest] = root.children;
  if (only?.type === 'paragraph' && !rest.length) {
    return new MarkdownElement('inline', 'inlineFragment', 'an inline Markdown fragment', only.children, style);
  }
  return new MarkdownElement('block', 'fragment', 'a Markdown fragment', root.children, style);
}

/** Make the placeholders in text raw, in place, so rendering can't escape them. */
function keepPlaceholders(parent: Parent): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === 'text') return textNodes(child.value);
    if ('children' in child) keepPlaceholders(child);
    return [child];
  });
}

/** Parse a template into a tree, with each placeholder in its text as a node of its own. */
function templateTree(markdown: string, inline: boolean): Root {
  const root = parseTree(markdown, inline);
  splitPlaceholders(root);
  return root;
}

/** Make the placeholders in text nodes of their own, in place. */
function splitPlaceholders(parent: Parent): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === 'text') return placeholderPieces(child.value);
    if ('children' in child) splitPlaceholders(child);
    return [child];
  });
}

function placeholderPieces(text: string): PhrasingContent[] {
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
 * Lists the block constructs turned off when parsing an inline template.
 * The names are micromark's construct names.
 */
const blockConstructs = [
  'blockQuote',
  'codeFenced',
  'codeIndented',
  'definition',
  'gfmFootnoteDefinition',
  'headingAtx',
  'htmlFlow',
  'list',
  'setextUnderline',
  'table',
  'thematicBreak',
];

function parseTree(markdown: string, inline: boolean): Root {
  const processor = unified().use(remarkParse).use(remarkGfm);
  if (inline) {
    processor.use(function disableBlocks() {
      const data = this.data();
      (data.micromarkExtensions ??= []).push({ disable: { null: blockConstructs } });
    });
  }
  return processor.parse(markdown);
}

/** Return a lookup for the values. A resolver's result that isn't a template value counts as no value. */
function resolverOf(values: TemplateValues | TemplateResolver): TemplateResolver {
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
function substituteInTree(root: Root, resolve: TemplateResolver, allowBlocks: boolean): void {
  const substituteInCode = (code: string, inside: 'code' | 'HTML'): string =>
    replacePlaceholders(code, (name: string) => {
      const value = resolve(name);
      return value === undefined ? undefined : valueAsCode(value, name, inside);
    });
  const substituteInLink = (written: string, inside: 'a URL' | 'a title'): string =>
    replacePlaceholders(written, (name: string) => {
      const value = resolve(name);
      return value === undefined ? undefined : valueInLink(value, name, inside);
    });

  /**
   * @param paragraph - the nodes are a paragraph's children, and whether the paragraph can split.
   * @param blocks - the nodes may be blocks.
   */
  const substituteInNodes = (nodes: RootContent[], paragraph: ParagraphMode | undefined, blocks: boolean): Piece[] =>
    nodes.flatMap((node, i): Piece[] => {
      const inlineHtml = asInlineHtmlNode(node);
      if (inlineHtml) {
        inlineHtml.value = substituteInCode(inlineHtml.value, 'HTML');
        return [node];
      }
      const placeholder = asPlaceholderNode(node);
      if (placeholder) {
        const name = placeholderName(placeholder);
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
        node.url = substituteInLink(node.url, 'a URL');
        if (node.title) node.title = substituteInLink(node.title, 'a title');
      }
      switch (node.type) {
        case 'paragraph': {
          const mode = blocks ? 'split' : 'join';
          return splitParagraph(node, withoutEmptiedLines(substituteInNodes(node.children, mode, false), mode));
        }
        case 'yaml':
          node.value = replacePlaceholders(node.value, (name: string) => {
            const value = resolve(name);
            return value === undefined ? undefined : valueAsFrontmatter(value);
          });
          return [node];
        case 'html':
          node.value = substituteInCode(node.value, 'HTML');
          return [node];
        case 'inlineCode':
        case 'code':
          node.value = substituteInCode(node.value, 'code');
          return [node];
        default:
          if ('children' in node) {
            const blockChildren = blocks && blockContainers.has(node.type);
            const children = substituteInNodes(node.children, undefined, blockChildren);
            // A list's children are its items already; any other block container may get list items from values.
            const grouped = blockChildren && node.type !== 'list' ? inLists(children as RootContent[]) : children;
            node.children = grouped as typeof node.children;
          }
          return [node];
      }
    });

  root.children = inLists(substituteInNodes(root.children, undefined, allowBlocks) as RootContent[]);
}

/** Rebuild a paragraph from its children after substitution, split around the blocks among them. */
function splitParagraph(paragraph: Paragraph, pieces: Piece[]): RootContent[] {
  if (!pieces.some(isBlockSlot)) {
    paragraph.children = pieces as PhrasingContent[];
    return [paragraph];
  }
  const result: RootContent[] = [];
  let line: PhrasingContent[] = [];
  const endParagraph = (): void => {
    const children = trimLine(line);
    if (children.length) result.push({ type: 'paragraph', children });
    line = [];
  };
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

function valueAsInline(value: TemplateValue, name: string): PhrasingContent[] {
  if (typeof value === 'number' || typeof value === 'boolean') return textNodes(String(value));
  // A template value can be any kind. inlineNodes throws when it isn't inline.
  return inlineNodes(value as InlineContent, `{@ ${name} @}`);
}

/**
 * Convert a value for use inside code or HTML, as `inside` says.
 * Only a string, text, a placeholder or an HTML entity goes in, as is.
 * An entity goes in as its reference in HTML, which reads it, and as its character in code, which doesn't.
 */
function valueAsCode(value: TemplateValue, name: string, inside: 'code' | 'HTML'): string {
  const written = valueAsWritten(value);
  if (written !== undefined) return written;
  if (isHtmlEntity(value)) return inside === 'HTML' ? value.toString() : value.character;
  throw new TypeError(
    `{@ ${name} @} is inside ${inside} and takes only a string, text, a placeholder or an HTML entity, got ${describe(value)}`,
  );
}

/** Convert a value for use in a link's URL or title. Only a string, text or a placeholder goes in, as is. */
function valueInLink(value: TemplateValue, name: string, inside: 'a URL' | 'a title'): string {
  const written = valueAsWritten(value);
  if (written !== undefined) return written;
  throw new TypeError(
    `{@ ${name} @} is inside ${inside} and takes only a string, text or a placeholder, got ${describe(value)}`,
  );
}

/** Return a string, text or placeholder value as written, or `undefined` for any other value. */
function valueAsWritten(value: TemplateValue): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isText(value)) return value.text;
  if (isKind(value, 'inline') && value.type === 'placeholder') return value.toString();
  return undefined;
}

/**
 * Convert a value for use inside frontmatter, as is: a string as written, and a Markdown element as rendered.
 * An HTML entity goes in as its character, since YAML doesn't read references.
 */
function valueAsFrontmatter(value: TemplateValue): string {
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
