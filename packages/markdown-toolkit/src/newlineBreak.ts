import type { Break, Data, RootContent } from 'mdast';

/** Marks a line break made from a newline in a string, as opposed to one from `lineBreak()`. */
interface NewlineData extends Data {
  fromNewline: true;
}

/** A line break for a newline in a string. */
export function newlineBreak(): Break {
  const data: NewlineData = { fromNewline: true };
  return { type: 'break', data };
}

/** Whether the node is a line break made from a newline in a string. */
export function isNewlineBreak(node: RootContent | undefined): boolean {
  return node?.type === 'break' && (node.data as Partial<NewlineData> | undefined)?.fromNewline === true;
}
