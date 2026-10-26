// For tools that fill placeholders in an mdast tree, such as inject-markdown.
export { detectMarkdownStyle } from './detectStyle.ts';
export type { PlaceholderResolver } from './placeholderSubstitution.ts';
export {
  isUnsafeSegment,
  isValidPlaceholderName,
  isValidPlaceholderSegment,
  substituteInString,
  substituteInTree,
} from './placeholderSubstitution.ts';
