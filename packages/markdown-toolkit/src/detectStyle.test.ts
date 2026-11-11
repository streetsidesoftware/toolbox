import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { detectStyle, document, emphasis, list } from './index.ts';

describe('detectStyle', () => {
  test('detectStyle reads the style an existing file uses', () => {
    const existing = '# Title\n\n* one\n* two\n\nSome *em* and __strong__.\n\n~~~\ncode\n~~~\n';
    const style = detectStyle(existing);
    assert.partialDeepStrictEqual(style, { bullet: '*', emphasis: '*', strong: '_', fence: '~' });
    assert.equal(
      document(list([emphasis('x')]))
        .withStyle(style)
        .toString(),
      '* *x*\n',
    );
  });
});
