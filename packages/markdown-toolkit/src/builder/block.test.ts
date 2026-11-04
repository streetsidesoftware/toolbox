import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  document,
  heading,
  horizontalRule,
  hr,
  lineBreak,
  link,
  list,
  p,
  paragraph,
  placeholder,
  strong,
  substitutePlaceholders,
  table,
  template,
  toBlock,
} from '../index.ts';
import type { MDElement, MDParagraph } from '../index.ts';

describe('heading', () => {
  test('a heading depth outside 1 to 6', () => {
    // @ts-expect-error 7 is not a heading depth
    assert.throws(() => heading(7, 'x'), /heading depth must be 1 to 6, got 7/);
  });
});

describe('toBlock', () => {
  test('a block is returned unchanged', () => {
    const block = list(['a']);
    assert.equal(toBlock(block), block);
    const blocks = [heading(2, 'A'), list(['a'])];
    assert.equal(toBlock(blocks), blocks);
  });

  test('inline content becomes a paragraph', () => {
    assert.equal(document(toBlock('Hello')).toString(), 'Hello\n');
    assert.equal(document(toBlock(['See ', link('docs', 'u')])).toString(), 'See [docs](u)\n');
  });

  test('each inline run becomes a paragraph, and blocks stay', () => {
    const md = document(toBlock(['Intro ', strong('x'), list(['a']), 'Outro']));
    assert.equal(md.toString(), 'Intro **x**\n\n- a\n\nOutro\n');
  });
});

describe('paragraph', () => {
  test('p is the same function', () => {
    assert.equal(p, paragraph);
    assert.equal(document(p('A'), p('B')).toString(), 'A\n\nB\n');
  });

  testEach`
    value                                         | expected
    ${paragraph(' a\t')}                          | ${'a'}
    ${paragraph([strong('a '), ' '])}             | ${'**a**'}
    ${heading(1, 'a ')}                           | ${'# a'}
    ${template('# a {@ x @}', { x: '' })}         | ${'# a'}
    ${table(['h '], [[' a']])}                    | ${'| h |\n| - |\n| a |'}
    ${paragraph(' ')}                             | ${'&#x20;'}
  `(
    'a paragraph, heading or cell loses the spaces and tabs at its edges, unless it has nothing else: $expected',
    ({ value, expected }: { value: MDElement; expected: string }) => {
      assert.equal(value.toString(), expected);
    },
  );

  test('an empty paragraph renders nothing', () => {
    assert.equal(p('').toString(), '');
  });

  testEach`
    value                 | label
    ${p('\n')}            | ${"p('\\n')"}
    ${p(lineBreak())}     | ${'p(lineBreak())'}
    ${p(' \n ')}          | ${"p(' \\n ')"}
  `('a paragraph that trimming leaves empty adds no blank lines: $label', ({ value }: { value: MDParagraph }) => {
    assert.equal(document('a', value, 'b').toString(), 'a\n\nb\n');
  });

  test('a paragraph of empty formatting stays', () => {
    assert.equal(document('a', p(strong('')), 'b').toString(), 'a\n\n**&#x20;**\n\nb\n');
  });

  test('an empty paragraph adds no blank lines, but still ends the text before it', () => {
    assert.equal(document('a', p(''), 'b').toString(), document(p('a'), p('b')).toString());
    assert.equal(document('a', p(''), 'b').toString(), 'a\n\nb\n');
  });

  test('an empty paragraph between blocks', () => {
    const md = document(heading(2, 'Release notes'), p(''), list(['x']));
    assert.equal(md.toString(), '## Release notes\n\n- x\n');
  });

  test('a paragraph left empty by substitution renders nothing', () => {
    const md = document('a', p(placeholder('x')), 'b');
    assert.equal(substitutePlaceholders(md, { x: '' }).toString(), 'a\n\nb\n');
  });

  test('a paragraph of whitespace stays', () => {
    assert.equal(p(' ').toString(), '&#x20;');
    assert.equal(document('a', p(' '), 'b').toString(), 'a\n\n&#x20;\n\nb\n');
  });

  test('a paragraph of whitespace in formatting renders', () => {
    assert.equal(p(strong(' ')).toString(), '**&#x20;**');
  });
});

describe('horizontalRule', () => {
  test('a line between sections, in the document style', () => {
    assert.equal(hr, horizontalRule);
    const md = document(paragraph('A'), horizontalRule(), 'B');
    assert.equal(md.toString(), 'A\n\n---\n\nB\n');
    assert.equal(md.withStyle({ rule: '*' }).toString(), 'A\n\n***\n\nB\n');
  });

  test('it cannot go inside a line', () => {
    // @ts-expect-error a horizontal rule is a block
    assert.throws(() => paragraph(hr()), new TypeError('paragraph content must be inline, got a horizontal rule'));
  });
});
