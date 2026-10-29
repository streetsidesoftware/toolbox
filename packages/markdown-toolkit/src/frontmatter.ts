import type { Yaml } from 'mdast';

import { MarkdownElement, renderingOf } from './nodes.ts';
import type { MDFrontmatter } from './types.ts';

/** A first line of exactly `---`, up to the next line of exactly `---`. */
const frontmatterPattern = /^---\r?\n(?:([\s\S]*?)\r?\n)??---(?:\r?\n|$)/;

/** Frontmatter read from the start of a file. */
export interface FrontmatterMatch {
  /** The YAML text between the `---` lines. */
  readonly yaml: string;
  /** The offset just past the closing `---` line, line ending included. */
  readonly end: number;
}

/** The frontmatter at the very start of a whole file, or `undefined` if it has none. */
export function readFrontmatter(markdown: string): FrontmatterMatch | undefined {
  const match = frontmatterPattern.exec(markdown);
  return match ? { yaml: match[1] ?? '', end: match[0].length } : undefined;
}

/**
 * YAML frontmatter, for the start of a document. The text is inserted as is, between `---` lines.
 * Making it valid YAML is up to the caller.
 * @category Whole pages
 */
export function frontmatter(yaml: string): MDFrontmatter {
  // The closing `---` starts its own line, so a line ending at the end of the text is that line's.
  return new MarkdownElement('frontmatter', 'frontmatter', [yamlNode(yaml.replace(/\r?\n$/, ''))]);
}

export function yamlNode(yaml: string): Yaml {
  return { type: 'yaml', value: yaml };
}

export function isFrontmatter(value: unknown): value is MDFrontmatter {
  return renderingOf(value) !== undefined && (value as MDFrontmatter).kind === 'frontmatter';
}
