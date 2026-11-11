import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { assertIsMDElement, MarkdownElement } from './element.ts';

describe('assertIsMDElement', () => {
  test('an element passes', () => {
    const element = new MarkdownElement('block', 'paragraph', 'a paragraph', []);
    assert.doesNotThrow(() => assertIsMDElement(element, 'a Markdown element'));
  });

  test('anything else throws a TypeError naming what was expected and what was given', () => {
    assert.throws(
      () => assertIsMDElement(42, 'a string or a Markdown element'),
      new TypeError('expected a string or a Markdown element, got a number'),
    );
  });

  test('an object that only looks like an element throws', () => {
    const lookAlike = { kind: 'block', type: 'paragraph', description: 'a paragraph' };
    assert.throws(
      () => assertIsMDElement(lookAlike, 'a Markdown element'),
      new TypeError('expected a Markdown element, got an object'),
    );
  });
});
