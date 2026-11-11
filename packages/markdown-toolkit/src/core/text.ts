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
