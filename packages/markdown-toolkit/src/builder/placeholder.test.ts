import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { blockPlaceholder, document, heading, inlineCode, placeholder, text } from '../index.ts';

describe('placeholders', () => {
  test('a placeholder renders as written', () => {
    assert.equal(placeholder('engines.cspell').toString(), '{@ engines.cspell @}');
  });

  test('escaping text leaves placeholder syntax alone', () => {
    assert.equal(text('{@ _a_b.c-d @} and *x*').toString(), '{@ _a_b.c-d @} and \\*x\\*');
  });

  test('a placeholder fits inside inline code as a string', () => {
    assert.equal(inlineCode(`version: ${placeholder('engine.version')}`).toString(), '`version: {@ engine.version @}`');
  });

  test('an invalid name throws', () => {
    assert.throws(() => placeholder('-bad'), /invalid placeholder name/);
  });

  test('a name such as constructor is a name like any other', () => {
    assert.equal(placeholder('a.constructor').toString(), '{@ a.constructor @}');
  });
});

describe('placeholders', () => {
  test('placeholder() is inline, and blockPlaceholder() is a block', () => {
    assert.partialDeepStrictEqual(placeholder('a.b'), { kind: 'inline', type: 'placeholder', name: 'a.b' });
    assert.partialDeepStrictEqual(blockPlaceholder('a.b'), { kind: 'block', type: 'blockPlaceholder' });
    assert.equal(heading(2, ['v', placeholder('v')]).toString(), '## v{@ v @}');
    assert.equal(document('Intro', blockPlaceholder('x')).toString(), 'Intro\n\n{@ x @}\n');
  });

  test('a block placeholder cannot go inside a line', () => {
    assert.throws(
      // @ts-expect-error a block placeholder is a block
      () => heading(2, blockPlaceholder('x')),
      new TypeError('heading content must be inline, got a block placeholder'),
    );
  });

  test('an invalid name throws', () => {
    assert.throws(() => blockPlaceholder('a..b'), new Error('invalid placeholder name: "a..b"'));
  });
});
