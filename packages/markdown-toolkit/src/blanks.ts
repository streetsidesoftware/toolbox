import type { PhrasingContent } from 'mdast';

/**
 * Return the inline nodes without the spaces, tabs and line endings at their start and end.
 * Text left empty is dropped.
 */
export function trimBlanks(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  return trimBlanksAtEnd(trimBlanksAtStart(nodes));
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
    for (const kept of trimBlanksAtEnd(result.length ? trimBlanksAtStart(line) : line)) result.push(kept);
    result.push(node);
    line = [];
  }
  for (const kept of trimBlanksAtStart(line)) result.push(kept);
  return result;
}

/** Check whether a character is a space, a tab or part of a line ending. */
export function isBlank(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

function trimBlanksAtStart(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  for (let i = 0; i < nodes.length; ++i) {
    const node = nodes[i];
    if (node.type !== 'text') return nodes.slice(i);
    const value = trimStart(node.value);
    if (value) return [{ ...node, value }, ...nodes.slice(i + 1)];
  }
  return [];
}

function trimBlanksAtEnd(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  for (let i = nodes.length - 1; i >= 0; --i) {
    const node = nodes[i];
    if (node.type !== 'text') return nodes.slice(0, i + 1);
    const value = trimEnd(node.value);
    if (value) return [...nodes.slice(0, i), { ...node, value }];
  }
  return [];
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
