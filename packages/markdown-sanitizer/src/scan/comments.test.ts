import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Html } from 'mdast';

import { findComments } from './comments.ts';

test('takes time in proportion to the document while a comment is left open', () => {
  const count = 200_000;
  const markdown = '<!--' + ' <b>'.repeat(count);
  const nodes = [htmlNode(markdown, 0, 4)];
  for (let index = 0; index < count; index++) nodes.push(htmlNode(markdown, 5 + 4 * index, 8 + 4 * index));

  const start = performance.now();
  const comments = findComments(markdown, nodes, 0);
  const elapsed = performance.now() - start;

  assert.deepEqual(comments, [{ start: 0, end: markdown.length, node: nodes[0] }]);
  assert.ok(elapsed < 1000, `took ${elapsed} ms`);
});

function htmlNode(markdown: string, start: number, end: number): Html {
  return {
    type: 'html',
    value: markdown.slice(start, end),
    position: { start: { line: 1, column: start + 1, offset: start }, end: { line: 1, column: end + 1, offset: end } },
  };
}
