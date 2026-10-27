// For tools that fill placeholders in an mdast tree, such as inject-markdown.
export { isValidPlaceholderName } from '@streetsidesoftware/placeholders';
export type { PlaceholderResolver } from '@streetsidesoftware/placeholders';
export { detectMarkdownStyle } from './detectStyle.ts';
export type { MdastRoot } from './types.ts';
export { substituteInString, substituteInTree } from './placeholderSubstitution.ts';
