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
 * - `htmlInlineSlot`: one paragraph, such as a summary. It goes on one line, and a placeholder in it takes only inline
 *   values.
 * - `htmlBlockSlot`: anything a document can hold, such as a table cell. It gets blank lines, unless it's empty.
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
 * Tags and content on one line form one `html` node, since remark joins nodes with blank lines.
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
    const markup = child.type === 'htmlInlineSlot' ? writeInlineSlot(child.children) : writeEmptySlot(child.children);
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

/** Return the HTML of a slot's paragraph, or `undefined` when it can't be written as HTML. */
function writeInlineSlot(blocks: readonly RootContent[]): string | undefined {
  const [paragraph] = blocks;
  if (paragraph?.type !== 'paragraph') return '';
  // A line break at the start or end can't display, as in a paragraph.
  return writeInline(trimLineEdges(trimBlanksAroundBreaks(paragraph.children)));
}

/** Return no HTML for a slot with nothing in it, or `undefined` when it has content. */
function writeEmptySlot(blocks: readonly RootContent[]): string | undefined {
  return blocks.every((block) => block.type === 'paragraph' && !block.children.length) ? '' : undefined;
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
 * Return one inline node as HTML, or `undefined` when it has to stay Markdown because it has no HTML form, such as a
 * reference, whose URL is in a definition that only Markdown can look up.
 */
function writeNode(node: PhrasingContent): string | undefined {
  switch (node.type) {
    case 'text':
      return htmlEscape(node.value);
    case 'break':
      return '<br/>';
    case 'htmlEntity':
    case 'placeholder':
    case 'html':
    case 'inlineHtml':
      return (node as Literal).value;
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

function htmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
