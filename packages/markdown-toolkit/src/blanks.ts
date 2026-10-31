import type { Delete, Emphasis, Nodes, PhrasingContent, Strong } from 'mdast';

/**
 * Return the inline nodes without the spaces, tabs and line endings at their start and end.
 * Text left empty is dropped.
 */
export function trimBlanks(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  return trimBlanksAtEnd(trimBlanksAtStart(nodes, false), false);
}

/**
 * Return a paragraph's, heading's or table cell's inline nodes without the spaces, tabs, line endings and line breaks
 * at their start and end. Nothing is on their other side, so they would only show escaped, or as a literal `\`.
 * A paragraph of only spaces and tabs keeps them, since it still shows as a paragraph.
 */
export function trimLineEdges(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  const trimmed = trimBlanksAtEnd(trimBlanksAtStart(nodes, true), true);
  if (trimmed.length || !nodes.some(hasSpaceOrTab)) return trimmed;
  return nodes.filter((node) => node.type !== 'break');
}

/**
 * Return the inline nodes without the spaces, tabs and line endings next to a line break.
 * The break already ends the line, so they would only show escaped, as `&#x20;` or `&#xA;`.
 */
export function trimBlanksAroundBreaks(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  if (!nodes.some((node) => node.type === 'break')) return [...nodes];
  const result: PhrasingContent[] = [];
  let line: PhrasingContent[] = [];
  for (const node of nodes) {
    if (node.type !== 'break') {
      line.push(node);
      continue;
    }
    for (const kept of trimBlanksAtEnd(result.length ? trimBlanksAtStart(line, false) : line, false)) result.push(kept);
    result.push(node);
    line = [];
  }
  for (const kept of trimBlanksAtStart(line, false)) result.push(kept);
  return result;
}

/**
 * Return the inline nodes with each line ending in their text alone: the spaces, tabs and empty lines around it go.
 * At the edge of a line they would only show escaped, and a paragraph can't hold an empty line.
 * Text next to text is joined first, so a line ending split between the two counts too.
 */
export function trimAroundLineEndings(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  const joined: PhrasingContent[] = [];
  for (const node of nodes) {
    const before = joined.at(-1);
    if (node.type === 'text' && before?.type === 'text') {
      joined[joined.length - 1] = { ...before, value: before.value + node.value };
    } else {
      joined.push(node);
    }
  }
  return joined.map((node) => (node.type === 'text' ? { ...node, value: singleLineEndings(node.value) } : node));
}

/** Return the text with each run of blanks that holds a line ending as one line ending. */
function singleLineEndings(text: string): string {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; ++i) {
    if (!isBlank(text[i])) continue;
    let end = i;
    let endings = 0;
    while (isBlank(text[end])) {
      if (text[end] === '\n' || (text[end] === '\r' && text[end + 1] !== '\n')) ++endings;
      ++end;
    }
    const lineEnding = text.slice(i, end);
    if (endings && lineEnding !== '\n' && lineEnding !== '\r\n' && lineEnding !== '\r') {
      parts.push(text.slice(start, i), '\n');
      start = end;
    }
    i = end - 1;
  }
  parts.push(text.slice(start));
  return parts.join('');
}

/** Check whether a character is a space, a tab or part of a line ending. */
function isBlank(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

/** @param breaks - line breaks go too. */
function trimBlanksAtStart(nodes: readonly PhrasingContent[], breaks: boolean): PhrasingContent[] {
  for (let i = 0; i < nodes.length; ++i) {
    const node = nodes[i];
    if (breaks && node.type === 'break') continue;
    if (isFormatting(node)) {
      return [trimmedInside(node, (children) => trimBlanksAtStart(children, breaks)), ...nodes.slice(i + 1)];
    }
    if (node.type !== 'text') return nodes.slice(i);
    const value = trimStart(node.value);
    if (value) return [{ ...node, value }, ...nodes.slice(i + 1)];
  }
  return [];
}

/** @param breaks - line breaks go too. */
function trimBlanksAtEnd(nodes: readonly PhrasingContent[], breaks: boolean): PhrasingContent[] {
  for (let i = nodes.length - 1; i >= 0; --i) {
    const node = nodes[i];
    if (breaks && node.type === 'break') continue;
    if (isFormatting(node)) {
      return [...nodes.slice(0, i), trimmedInside(node, (children) => trimBlanksAtEnd(children, breaks))];
    }
    if (node.type !== 'text') return nodes.slice(0, i + 1);
    const value = trimEnd(node.value);
    if (value) return [...nodes.slice(0, i), { ...node, value }];
  }
  return [];
}

/**
 * Return the formatting with its text trimmed at one side.
 * Formatting with only blanks in it stays as it is: it shows as a space, as empty formatting does.
 */
function trimmedInside<T extends Delete | Emphasis | Strong>(
  node: T,
  trim: (nodes: readonly PhrasingContent[]) => PhrasingContent[],
): T {
  const children = trim(node.children);
  return children.length ? { ...node, children } : node;
}

function hasSpaceOrTab(node: PhrasingContent): boolean {
  return node.type === 'text' && (node.value.includes(' ') || node.value.includes('\t'));
}

export function isFormatting(node: Nodes): node is Delete | Emphasis | Strong {
  return node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete';
}

function trimStart(text: string): string {
  let start = 0;
  while (isBlank(text[start])) ++start;
  return text.slice(start);
}

function trimEnd(text: string): string {
  let end = text.length;
  while (isBlank(text[end - 1])) --end;
  return text.slice(0, end);
}
