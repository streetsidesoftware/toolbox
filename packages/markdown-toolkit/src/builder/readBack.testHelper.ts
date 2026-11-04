import assert from 'node:assert/strict';

import type { PhrasingContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** Parse Markdown and return its first paragraph's pieces as `type:value`, nested formatting as its text. */
export function readBack(markdown: string): string[] {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const [first] = root.children;
  assert.equal(first.type, 'paragraph');
  return first.children.map((node) => `${node.type}:${textOf(node)}`);
}

function textOf(node: PhrasingContent): string {
  if ('value' in node) return node.value;
  if ('children' in node) return node.children.map(textOf).join('');
  return '';
}
