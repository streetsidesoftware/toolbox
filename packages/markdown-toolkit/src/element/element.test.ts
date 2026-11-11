import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { assertCondition, assertIsArray, assertIsMDElement, MarkdownElement } from './element.ts';

describe('assertCondition', () => {
  test('a condition that holds passes', () => {
    assert.doesNotThrow(() => assertCondition(true, 'heading depth must be 1 to 6, got 3'));
  });

  test('a condition that fails throws a TypeError with the message', () => {
    assert.throws(
      () => assertCondition(false, 'heading depth must be 1 to 6, got 7'),
      new TypeError('heading depth must be 1 to 6, got 7'),
    );
  });
});

describe('assertIsArray', () => {
  test('an array passes', () => {
    assert.doesNotThrow(() => assertIsArray(['A'], 'table header'));
  });

  test('anything else throws a TypeError naming the value and what was given', () => {
    assert.throws(
      () => assertIsArray('A', 'table header'),
      new TypeError('table header must be an array, got a string'),
    );
  });
});

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
