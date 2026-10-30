import { listPlaceholders, replacePlaceholders } from '@streetsidesoftware/placeholders';
import type { Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { text } from './builders.ts';
import { detectMarkdownStyle } from './detectStyle.ts';
import { DocumentElement } from './documentElement.ts';
import { readFrontmatter, yamlNode } from './frontmatter.ts';
import { isHtmlEntity } from './htmlEntity.ts';
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

/** A value a template placeholder can take. */
export type TemplateValue = string | number | boolean | MDElement | readonly TemplateValue[];

/**
 * The values for a template.
 * - A top-level key may be a dotted name, such as `'engines.cspell'`.
 * - A nested object is walked one segment at a time.
 * - When several keys could supply a name, the later key wins.
 */
export interface TemplateValues {
  readonly [name: string]: TemplateValue | TemplateValues | undefined;
}

/**
 * Creates Markdown from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * - A string value shows exactly as given.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string, which goes in as given, or an {@link htmlEntity}.
 *   In code it shows as its character, and in HTML as its reference.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * A result of one paragraph can go anywhere a string can. A longer one goes where paragraphs can.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
 * @example
 * md.template('Install {@name@} with npm.', { name: 'cspell' });
 * // Install cspell with npm.
 * @category templates
 */
export function template(markdown: string, values: TemplateValues): MDFragment | MDInlineFragment {
  const root = templateTree(markdown, false);
  substituteInTree(root, values, true);
  return fragment(root, markdown);
}

/**
 * Creates paragraphs and other blocks from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * - A string value shows exactly as given.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string, which goes in as given, or an {@link htmlEntity}.
 *   In code it shows as its character, and in HTML as its reference.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
 * @example
 * md.blockTemplate('Hello {@name@}.', { name: 'world' });
 * // Hello world.
 * @category templates
 */
export function blockTemplate(markdown: string, values: TemplateValues): MDFragment {
  const root = templateTree(markdown, false);
  substituteInTree(root, values, true);
  return new MarkdownElement(
    'block',
    'fragment',
    'a Markdown fragment',
    root.children,
    detectMarkdownStyle(root, markdown),
  );
}

/**
 * Creates a line of Markdown from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * Use the result in a heading, a table cell, a link or a sentence.
 *
 * - A string or number shows exactly as given.
 * - A value can be text, a link, formatting or code.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
 * @example
 * md.inlineTemplate('Version {@version@}', { version: '2.0' });
 * // Version 2.0
 * @category templates
 */
export function inlineTemplate(markdown: string, values: TemplateValues): MDInlineFragment {
  const start = markdown.trimStart();
  const lead = markdown.slice(0, markdown.length - start.length);
  const body = start.trimEnd();
  const tail = start.slice(body.length);
  const root = templateTree(body, true);
  if (root.children.length > 1 || (root.children[0] && root.children[0].type !== 'paragraph')) {
    throw new Error('inline template text must be one paragraph');
  }
  substituteInTree(root, values, false);
  const children = root.children[0]?.type === 'paragraph' ? root.children[0].children : [];
  return new MarkdownElement('inline', 'inlineFragment', 'an inline Markdown fragment', [
    ...textNodes(lead),
    ...children,
    ...textNodes(tail),
  ]);
}

/**
 * Parses Markdown text so it can be added to a page with its formatting.
 *
 * Text of one paragraph can go anywhere a string can, even in a heading.
 * Longer text goes where paragraphs can, such as in a document or a list item.
 *
 * @example
 * md.parse('Some **bold** text.');
 * // On the page, "bold" is bold.
 * @category text
 */
export function parse(markdown: string): MDFragment | MDInlineFragment {
  const root = parseTree(markdown, false);
  keepPlaceholders(root);
  return fragment(root, markdown);
}

/**
 * Parses a whole Markdown file, frontmatter included.
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
 * Creates a whole Markdown file from a template by substituting values for its `{​@ name @​}` placeholders.
 *
 * Placeholders in the frontmatter work too, and a value there goes in as given.
 *
 * - A string value shows exactly as given.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string, which goes in as given, or an {@link htmlEntity}.
 *   In code it shows as its character, and in HTML as its reference.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
 * @example
 * md.templateDocument('# {@title@}\n\nBody.', { title: 'Dictionaries' });
 * // # Dictionaries
 * //
 * // Body.
 * @category templates
 */
export function templateDocument(markdown: string, values: TemplateValues): MDDocument {
  return documentOf(markdown, (body) => templateTree(body, false), values);
}

/**
 * Substitute values for the `{​@ name @​}` placeholders in an existing element, such as a parsed file, or in plain text.
 *
 * When the first argument is a string, it shows exactly as given, even if it contains Markdown or HTML. For a string
 * that's already Markdown, use {@link template}.
 *
 * Placeholders without a value stay in place, so you can substitute values in steps.
 *
 * - A string value shows exactly as given.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string, which goes in as given, or an {@link htmlEntity}.
 *   In code it shows as its character, and in HTML as its reference.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
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
  values: TemplateValues,
): MDText | MDInlineFragment | MDFragment;
export function substitutePlaceholders(
  content: MDInlineFragment,
  values: TemplateValues,
): MDInlineFragment | MDFragment;
export function substitutePlaceholders(content: MDParagraph, values: TemplateValues): MDParagraph | MDFragment;
export function substitutePlaceholders(
  content: MDPlaceholder,
  values: TemplateValues,
): MDPlaceholder | MDInlineFragment | MDFragment;
export function substitutePlaceholders(
  content: MDBlockPlaceholder,
  values: TemplateValues,
): MDBlockPlaceholder | MDFragment;
export function substitutePlaceholders(content: MDInline, values: TemplateValues): MDInline | MDFragment;
export function substitutePlaceholders<T extends MDElement>(content: T, values: TemplateValues): T;
export function substitutePlaceholders(content: MDElement | string, values: TemplateValues): MDElement {
  if (typeof content === 'string') return substitutePlaceholders(text(content), values);
  const rendering = renderingOf(content);
  if (!rendering) throw new TypeError(`expected a string or a Markdown element, got ${describe(content)}`);
  // An HTML entity has no placeholder in it, and keeps its character.
  if (isHtmlEntity(content)) return content;
  const substituted = isText(content) ? substituteInText(content.text, values) : undefined;
  if (substituted !== undefined) return text(substituted);
  const { style } = rendering;
  const nodes = structuredClone(rendering.nodes);
  switch (content.type) {
    case 'text':
    case 'inlineFragment':
      return fragmentOf(
        substitutedTree([{ type: 'paragraph', children: nodes as PhrasingContent[] }], values, true),
        style,
      );
    case 'paragraph': {
      const root = substitutedTree(nodes, values, true);
      if (root.children.length === 1 && root.children[0].type === 'paragraph') {
        return new MarkdownElement('block', 'paragraph', 'a paragraph', root.children, style);
      }
      return new MarkdownElement('block', 'fragment', 'a Markdown fragment', root.children, style);
    }
    case 'placeholder':
      if (resolveValue(values, (content as MDPlaceholder).name) === undefined) return content;
      return fragmentOf(
        substitutedTree([{ type: 'paragraph', children: nodes as PhrasingContent[] }], values, true),
        style,
      );
    case 'blockPlaceholder':
      if (resolveValue(values, (content as MDBlockPlaceholder).name) === undefined) return content;
      return new MarkdownElement(
        'block',
        'fragment',
        'a Markdown fragment',
        substitutedTree(nodes, values, true).children,
        style,
      );
    case 'document':
      return new DocumentElement(substitutedTree(nodes, values, true).children, style);
    default:
      return new MarkdownElement(
        content.kind,
        content.type,
        content.description,
        substitutedTree(nodes, values, content.kind !== 'inline').children,
        style,
      );
  }
}

/** A tree of nodes with the placeholders that have values replaced. */
function substitutedTree(nodes: RootContent[], values: TemplateValues, allowBlocks: boolean): Root {
  const root: Root = { type: 'root', children: nodes };
  substituteInTree(root, values, allowBlocks);
  return root;
}

/**
 * Text with its placeholders substituted, or `undefined` if a value isn't a string or text.
 * A placeholder with no value is kept as written.
 */
function substituteInText(text: string, values: TemplateValues): string | undefined {
  let onlyText = true;
  const result = replacePlaceholders(text, (name: string) => {
    const value = resolveValue(values, name);
    if (value === undefined) return undefined;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (isText(value)) return value.text;
    onlyText = false;
    return undefined;
  });
  return onlyText ? result : undefined;
}

/** A whole file as a document, its body read by `read`, with values substituted when there are any. */
function documentOf(markdown: string, read: (body: string) => Root, values?: TemplateValues): MDDocument {
  const front = readFrontmatter(markdown);
  const body = front ? markdown.slice(front.end) : markdown;
  const root = read(body);
  const style = detectMarkdownStyle(root, body);
  if (front) root.children.unshift(yamlNode(front.yaml));
  if (values) substituteInTree(root, values, true);
  return new DocumentElement(root.children, style);
}

/** A parsed tree as an element, in the style of its text. */
function fragment(root: Root, markdown: string): MDFragment | MDInlineFragment {
  return fragmentOf(root, detectMarkdownStyle(root, markdown));
}

/** A tree as an element. A single paragraph is inline, and anything else is blocks. */
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

/** A template's tree, with each placeholder in its text as a node of its own. */
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
 * Block constructs, turned off when parsing an inline template.
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

/** Blocks in place of a placeholder that is a whole line, until its paragraph is split around them. */
interface BlockSlot {
  readonly blocks: RootContent[];
}

type Piece = RootContent | BlockSlot;

/** Node types whose children may be blocks. */
const blockContainers = new Set(['blockquote', 'footnoteDefinition', 'list', 'listItem']);

/**
 * Replace the placeholders that have values, in place.
 * - A placeholder is a node of its own. In code and HTML, it's part of the text.
 * - Where blocks can go, a placeholder that is a whole line of a paragraph may take blocks.
 *   The paragraph splits around them.
 * @param allowBlocks - the root's children may be blocks.
 */
function substituteInTree(root: Root, values: TemplateValues, allowBlocks: boolean): void {
  const substituteInCode = (code: string, inside: 'code' | 'HTML'): string =>
    replacePlaceholders(code, (name: string) => {
      const value = resolveValue(values, name);
      return value === undefined ? undefined : valueAsCode(value, name, inside);
    });

  /**
   * @param lines - the nodes are a paragraph's children, and a whole-line placeholder may take blocks.
   * @param blocks - the nodes may be blocks.
   */
  const substituteInNodes = (nodes: RootContent[], lines: boolean, blocks: boolean): Piece[] =>
    nodes.flatMap((node, i): Piece[] => {
      const placeholder = asPlaceholderNode(node);
      if (placeholder) {
        const name = placeholderName(placeholder);
        const value = resolveValue(values, name);
        if (value === undefined) return [node];
        if (lines && isWholeLine(nodes, i) && isBlockLike(value)) {
          return [{ blocks: blockNodes(value, `{@ ${name} @}`) }];
        }
        return valueAsInline(value, name);
      }
      switch (node.type) {
        case 'paragraph': {
          const pieces = substituteInNodes(node.children, blocks, false);
          return splitParagraph(node, pieces);
        }
        case 'yaml':
          node.value = replacePlaceholders(node.value, (name: string) => {
            const value = resolveValue(values, name);
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
            const children = substituteInNodes(node.children, false, blockChildren);
            // A list's children are its items already; any other block container may get list items from values.
            const grouped = blockChildren && node.type !== 'list' ? inLists(children as RootContent[]) : children;
            node.children = grouped as typeof node.children;
          }
          return [node];
      }
    });

  root.children = inLists(substituteInNodes(root.children, false, allowBlocks) as RootContent[]);
}

/** A paragraph from its children after substitution, split around the blocks among them. */
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

/** Inline nodes without the line endings at their start and end. */
function trimLine(nodes: PhrasingContent[]): PhrasingContent[] {
  const result = nodes.filter((node, i) => node.type !== 'break' || (i > 0 && i < nodes.length - 1));
  const first = result[0];
  if (first?.type === 'text') result[0] = { ...first, value: first.value.replace(/^[ \t]*\r?\n/, '') };
  const last = result.at(-1);
  if (last?.type === 'text') result[result.length - 1] = { ...last, value: last.value.replace(/\r?\n[ \t]*$/, '') };
  return result.filter((node) => node.type !== 'text' || node.value);
}

/** Whether the node at `i` has nothing else on its line. */
function isWholeLine(nodes: readonly RootContent[], i: number): boolean {
  return endsLine(nodes[i - 1], /\n[ \t]*$/) && endsLine(nodes[i + 1], /^[ \t]*\r?\n/);
}

/** Whether a neighbor ends the line at its side: there is none, or it's a line break. */
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
 * A value inside code or HTML, as `inside` says: only a string, text, a placeholder or an HTML entity, inserted as is.
 * An entity goes in as its reference in HTML, which reads it, and as its character in code, which doesn't.
 */
function valueAsCode(value: TemplateValue, name: string, inside: 'code' | 'HTML'): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isText(value)) return value.text;
  if (isKind(value, 'inline') && value.type === 'placeholder') return value.toString();
  if (isHtmlEntity(value)) return inside === 'HTML' ? value.toString() : value.character;
  throw new TypeError(
    `{@ ${name} @} is inside ${inside} and takes only a string, text, a placeholder or an HTML entity, got ${describe(value)}`,
  );
}

/**
 * A value inside frontmatter, inserted as is: a string as written, and a Markdown element as rendered.
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
