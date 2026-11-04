import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  br,
  comment,
  document,
  heading,
  lineBreak,
  list,
  listItem,
  paragraph,
  substitutePlaceholders,
} from '../index.ts';
import type { MDElement } from '../index.ts';

describe('a comment goes where the call puts it', () => {
  testEach`
    value                                                 | expected
    ${document('a', comment('c'), 'b')}                   | ${'a\n<!-- c -->\nb\n'}
    ${document(['a', comment('c')], 'b')}                 | ${'a<!-- c -->\nb\n'}
    ${paragraph('a ', comment('c'), ' b')}                | ${'a <!-- c --> b'}
    ${document('a', [comment('c'), 'b'])}                 | ${'a\n<!-- c -->b\n'}
    ${paragraph('a', lineBreak(), comment('c'), 'b')}     | ${'a\\\n<!-- c -->b'}
    ${document(comment('c'), heading(1, 'T'))}            | ${'<!-- c -->\n\n# T\n'}
    ${paragraph('a', comment('c'), '\n', 'b')}            | ${'a<!-- c -->\\\nb'}
    ${paragraph('a', lineBreak(), br(), 'b')}             | ${'a\\\n<br/>b'}
    ${list([listItem('a', comment('c'), 'b')])}           | ${'- a\n  <!-- c -->\n  b'}
  `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('a placeholder in a comment inside a line is substituted', () => {
    assert.equal(substitutePlaceholders(paragraph('a ', comment('{@ x @}')), { x: 'y' }).toString(), 'a <!-- y -->');
  });
});
