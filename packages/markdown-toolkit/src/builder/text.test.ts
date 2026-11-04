import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { blockText, document, inlineText, list, paragraph, text } from '../index.ts';

describe('text', () => {
  test('text is inlineText', () => {
    assert.equal(text, inlineText);
  });

  test('a newline is a line break', () => {
    assert.equal(paragraph(inlineText('a\n- b')).toString(), 'a\\\n\\- b');
  });
});

describe('blockText', () => {
  testEach`
        value                   | expected
        ${'a\nb\n\nc\n'}        | ${'a\nb\n\nc'}
        ${'one line'}           | ${'one line'}
        ${'a\n \t\nb'}          | ${'a\n\nb'}
        ${'\n\na\n\n\n\nb\n\n'} | ${'a\n\nb'}
        ${'a\r\n\r\nb\rc'}      | ${'a\n\nb\nc'}
        ${'a\n- b\n# c\n1. d'}  | ${'a\n\\- b\n\\# c\n1\\. d'}
        ${'a\n===\n\n    code'} | ${'a\n\\===\n\ncode'}
        ${'a  \nb'}             | ${'a\nb'}
        ${'see {@ x @}\n\n*b*'} | ${'see {@ x @}\n\n\\*b\\*'}
        ${''}                   | ${''}
    `('blockText($value)', ({ value, expected }: { value: string; expected: string }) => {
    assert.equal(blockText(value).toString(), expected);
  });

  test('a single paragraph is still blocks', () => {
    const md = blockText('a\nb');
    assert.equal(md.kind, 'block');
    assert.equal(document(md, list(['x'])).toString(), 'a\nb\n\n- x\n');
  });
});
