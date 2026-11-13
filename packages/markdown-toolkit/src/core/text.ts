import { listPlaceholders } from '@streetsidesoftware/placeholders';
import type { PhrasingContent } from 'mdast';

import { placeholderNodeAsWritten } from './placeholderNode.ts';

/**
 * Return the text nodes for a string.
 * A placeholder is kept as written, so escaping never touches `{​@ name @​}`.
 */
export function textNodes(text: string): PhrasingContent[] {
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

/** Return the text nodes for a string, with each line ending as a line break. */
export function stringNodes(text: string): PhrasingContent[] {
  return text
    .split(/\r\n?|\n/)
    .flatMap((line, i): PhrasingContent[] => [...(i ? [{ type: 'break' } as const] : []), ...textNodes(line)]);
}

/** Join lines with a line ending, except next to a line break, which already ends the line. */
export function joinLines(lines: readonly PhrasingContent[][]): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  for (const line of lines) {
    const before = result.at(-1);
    if (before && before.type !== 'break' && line[0].type !== 'break') result.push({ type: 'text', value: '\n' });
    for (const node of line) result.push(node);
  }
  return result;
}
