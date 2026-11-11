import type { List, RootContent } from 'mdast';

/**
 * Put each run of list items in a bullet list. A run joins a list right before or after it, so a list item next to a
 * list is one more item of it, and the list keeps its numbering. Two lists in a row stay two lists.
 */
export function inLists(nodes: readonly RootContent[]): RootContent[] {
  const result: RootContent[] = [];
  let joined: List | undefined;
  let joinedBefore = false;
  for (const node of nodes) {
    if (node.type === 'listItem') {
      if (!joined) {
        const before = result.at(-1)?.type === 'list' ? (result.pop() as List) : undefined;
        joined = { type: 'list', ordered: false, spread: false, ...before, children: [...(before?.children ?? [])] };
        joinedBefore = before !== undefined;
        result.push(joined);
      }
      joined.children.push(node);
      continue;
    }
    if (joined && node.type === 'list') {
      // With no list before them, the list items join this one as its first items, so it keeps its own settings.
      if (!joinedBefore) Object.assign(joined, { ...node, children: joined.children });
      for (const item of node.children) joined.children.push(item);
      joined = undefined;
      continue;
    }
    joined = undefined;
    result.push(node);
  }
  return result;
}
