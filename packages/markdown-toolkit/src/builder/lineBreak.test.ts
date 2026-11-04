import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { br, heading, lineBreak, list, paragraph } from '../index.ts';

describe('line breaks', () => {
  test('lineBreak is a Markdown hard break in a paragraph', () => {
    assert.equal(paragraph('one', lineBreak(), 'two').toString(), 'one\\\ntwo');
  });

  test('lineBreak in a list item', () => {
    assert.equal(list([['one', lineBreak(), 'two']]).toString(), '- one\\\n  two');
  });

  test('br is always <br/>', () => {
    assert.equal(paragraph('one', br(), 'two').toString(), 'one<br/>two');
    assert.equal(heading(2, ['A', br(), 'B']).toString(), '## A<br/>B');
  });
});
