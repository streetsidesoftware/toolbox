import type {
  AlignType,
  Break,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Strong,
  Table,
  ThematicBreak,
  Yaml,
} from 'mdast';

// Code outside `core/` names node types from here, never from mdast itself.
export type { AlignType, BlockContent, Html, ListItem, PhrasingContent, Root, RootContent } from 'mdast';

export function paragraphNode(children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children };
}

export function headingNode(depth: Heading['depth'], children: PhrasingContent[]): Heading {
  return { type: 'heading', depth, children };
}

export function thematicBreakNode(): ThematicBreak {
  return { type: 'thematicBreak' };
}

export function strongNode(children: PhrasingContent[]): Strong {
  return { type: 'strong', children };
}

export function emphasisNode(children: PhrasingContent[]): Emphasis {
  return { type: 'emphasis', children };
}

export function deleteNode(children: PhrasingContent[]): Delete {
  return { type: 'delete', children };
}

export function linkNode(url: string, children: PhrasingContent[]): Link {
  return { type: 'link', url, children };
}

export function inlineCodeNode(value: string): InlineCode {
  return { type: 'inlineCode', value };
}

export function codeNode(value: string, lang: string | null): Code {
  return { type: 'code', lang, value };
}

export function breakNode(): Break {
  return { type: 'break' };
}

export function htmlNode(value: string): Html {
  return { type: 'html', value };
}

export function yamlNode(value: string): Yaml {
  return { type: 'yaml', value };
}

/** Return a list, numbered from `start` when it's given, and bulleted otherwise. */
export function listNode(children: ListItem[], start?: number): List {
  return { type: 'list', ordered: start !== undefined, start: start ?? null, spread: false, children };
}

/** Return a list item, with a checkbox when `checked` is given: ticked when it's `true`, and empty when `false`. */
export function listItemNode(children: ListItem['children'], checked?: boolean): ListItem {
  const item: ListItem = { type: 'listItem', spread: false, children };
  if (checked !== undefined) item.checked = checked;
  return item;
}

/** Return a table from the content of each cell, row by row. The first row is the header. */
export function tableNode(align: AlignType[], rows: PhrasingContent[][][]): Table {
  return {
    type: 'table',
    align,
    children: rows.map((cells) => ({
      type: 'tableRow',
      children: cells.map((children) => ({ type: 'tableCell', children })),
    })),
  };
}

/** Return the YAML of the frontmatter that starts the nodes, or `undefined` when they don't start with frontmatter. */
export function frontmatterOf(nodes: readonly RootContent[]): string | undefined {
  const [first] = nodes;
  return first?.type === 'yaml' ? first.value : undefined;
}

/** Return the nodes without the frontmatter that starts them, if any. */
export function withoutFrontmatter(nodes: RootContent[]): RootContent[] {
  return nodes[0]?.type === 'yaml' ? nodes.slice(1) : nodes;
}

/** Return the content of nodes that form one paragraph or nothing, or `undefined` when they hold anything else. */
export function paragraphContent(nodes: readonly RootContent[]): PhrasingContent[] | undefined {
  const [only, ...rest] = nodes;
  if (!only) return [];
  return only.type === 'paragraph' && !rest.length ? only.children : undefined;
}
