import type { Html, Literal, Parent, PhrasingContent, RootContent } from 'mdast';

import { trimBlanksAroundBreaks, trimLineEdges } from './blanks.ts';

/**
 * Describes HTML tags and the content between them, such as a summary or the cells of a table.
 * It stays in the tree through substitution, so rendering writes it knowing the values.
 * Only this package's own code sees it in mdast's content types; the published types leave mdast unchanged.
 */
export interface HtmlGroupNode extends Parent {
  type: 'htmlGroup';
  children: (Html | HtmlSlotNode)[];
}

/**
 * Describes content between two tags.
 * - `htmlInlineSlot`: one paragraph, such as a summary. A placeholder in it takes only inline values.
 * - `htmlBlockSlot`: anything a document can hold, such as a table cell.
 */
export interface HtmlSlotNode extends Parent {
  type: 'htmlInlineSlot' | 'htmlBlockSlot';
  open: string;
  close: string;
  children: RootContent[];
}

// mdast builds `RootContent` from its own map, so the nodes go in it.
declare module 'mdast' {
  interface RootContentMap {
    htmlGroup: HtmlGroupNode;
    htmlInlineSlot: HtmlSlotNode;
    htmlBlockSlot: HtmlSlotNode;
  }
}

/**
 * Return the nodes with each HTML group written as HTML.
 * Tags and content that fit on one line form one `html` node, since remark joins nodes with blank lines.
 * Content that can't be written as HTML gets blank lines around it, so it renders.
 */
export function writeHtmlGroups(nodes: readonly RootContent[]): RootContent[] {
  return nodes.flatMap((node): RootContent[] => {
    if (node.type === 'htmlGroup') return writeGroup(node);
    if ('children' in node) {
      return [{ ...node, children: writeHtmlGroups(node.children as RootContent[]) } as RootContent];
    }
    return [node];
  });
}

function writeGroup(group: HtmlGroupNode): RootContent[] {
  const nodes: RootContent[] = [];
  let lines: string[] = [];
  for (const child of group.children) {
    if (child.type === 'html') {
      lines.push(child.value);
      continue;
    }
    const markup = writeSlot(child.children);
    if (markup !== undefined) {
      lines.push(`${child.open}${markup}${child.close}`);
      continue;
    }
    lines.push(child.open);
    nodes.push({ type: 'html', value: lines.join('\n') }, ...writeHtmlGroups(child.children));
    lines = [child.close];
  }
  nodes.push({ type: 'html', value: lines.join('\n') });
  return nodes;
}

/** Return a slot's HTML when it's empty or one paragraph that can be written as HTML, or `undefined` otherwise. */
function writeSlot(blocks: readonly RootContent[]): string | undefined {
  if (!blocks.length) return '';
  const [first] = blocks;
  if (blocks.length !== 1 || first.type !== 'paragraph') return undefined;
  // A line break at the start or end can't display, as in a paragraph.
  return writeInline(trimLineEdges(trimBlanksAroundBreaks(first.children)));
}

function writeInline(nodes: readonly PhrasingContent[]): string | undefined {
  let markup = '';
  for (const node of trimBlanksAroundBreaks(nodes)) {
    const written = writeNode(node);
    if (written === undefined) return undefined;
    markup += written;
  }
  return markup;
}

/**
 * Return one inline node as HTML, or `undefined` when it has to stay Markdown:
 * - It's HTML with a blank line in it, which would end the HTML block.
 * - It has no HTML form, such as a reference, whose URL is in a definition that only Markdown can look up.
 *
 * A line ending in text, which a parsed paragraph can have, stays: it can't be a blank line.
 */
function writeNode(node: PhrasingContent): string | undefined {
  switch (node.type) {
    case 'text':
      return htmlEscape(node.value);
    case 'break':
      return '<br/>';
    case 'htmlEntity':
    case 'placeholder':
      return (node as Literal).value;
    case 'html':
    case 'inlineHtml':
      return hasBlankLine(node.value) ? undefined : node.value;
    case 'inlineCode':
      // Empty code shows as one space, and a line ending as a space, as in Markdown.
      return `<code>${htmlEscape(node.value.replace(/\r\n?|\n/g, ' ') || ' ')}</code>`;
    case 'strong':
      return writeFormatting('strong', node.children);
    case 'emphasis':
      return writeFormatting('em', node.children);
    case 'delete':
      return writeFormatting('del', node.children);
    case 'link': {
      const inner = writeInline(node.children);
      if (inner === undefined) return undefined;
      return `<a${writeAttributes(['href', node.url], ['title', node.title])}>${inner}</a>`;
    }
    case 'image':
      return `<img${writeAttributes(['src', node.url], ['alt', node.alt], ['title', node.title])}/>`;
    default:
      return undefined;
  }
}

/** Return formatting as HTML. Empty formatting shows as one formatted space, as in Markdown. */
function writeFormatting(tag: string, children: readonly PhrasingContent[]): string | undefined {
  const inner = writeInline(children);
  return inner === undefined ? undefined : `<${tag}>${inner || ' '}</${tag}>`;
}

/** Return the attributes that have a value. */
function writeAttributes(...attributes: readonly [string, string | null | undefined][]): string {
  let markup = '';
  for (const [name, value] of attributes) {
    if (value === null || value === undefined) continue;
    markup += ` ${name}="${htmlEscape(value).replace(/"/g, '&quot;')}"`;
  }
  return markup;
}

function hasBlankLine(text: string): boolean {
  return text.split(/\r\n?|\n/).some((line) => !line.trim());
}

function htmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
