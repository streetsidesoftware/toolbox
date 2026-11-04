import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import {
  comment,
  emphasis,
  heading,
  htmlEntity,
  inlineCode,
  lineBreak,
  link,
  list,
  paragraph,
  placeholder,
  strikethrough,
  strong,
  substitutePlaceholders,
  table,
} from '../index.ts';
import type { MDElement } from '../index.ts';
import { readBack } from './readBack.testHelper.ts';

describe('inlineCode', () => {
  testEach`
        value                                              | expected
        ${paragraph('a', inlineCode(''), 'b')}             | ${'a` `b'}
        ${paragraph(inlineCode(''))}                       | ${'` `'}
        ${paragraph(inlineCode(''), 'x', inlineCode(''))}  | ${'` `x` `'}
        ${paragraph(strong(inlineCode('')))}               | ${'**` `**'}
    `('empty code shows as a space: $expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('whitespace stays as given', () => {
    assert.equal(paragraph('a', inlineCode('  '), 'b').toString(), 'a`  `b');
  });

  test('code left empty by substitution shows as a space', () => {
    const md = paragraph('a', inlineCode('{@ x @}'), 'b');
    assert.equal(substitutePlaceholders(md, { x: '' }).toString(), 'a` `b');
  });

  const bothSpans = ['a', 'b'];

  testEach`
        value                                                                   | expected                                       | spans
        ${paragraph(inlineCode('a'), inlineCode('b'))}                          | ${'`a`&ZeroWidthSpace;`b`'}                     | ${bothSpans}
        ${paragraph(inlineCode('a'), '', inlineCode('b'))}                      | ${'`a`&ZeroWidthSpace;`b`'}                     | ${bothSpans}
        ${paragraph(inlineCode('a`'), inlineCode('`b'))}                        | ${'`` a` ``&ZeroWidthSpace;`` `b ``'}           | ${['a`', '`b']}
        ${paragraph(inlineCode('a'), inlineCode('b'), inlineCode('c'))}         | ${'`a`&ZeroWidthSpace;`b`&ZeroWidthSpace;`c`'}  | ${['a', 'b', 'c']}
        ${heading(2, [inlineCode('a'), inlineCode('b')])}                       | ${'## `a`&ZeroWidthSpace;`b`'}                  | ${bothSpans}
        ${paragraph(link([inlineCode('a'), inlineCode('b')], 'u'))}            | ${'[`a`&ZeroWidthSpace;`b`](u)'}                | ${bothSpans}
        ${paragraph(strong([inlineCode('a'), inlineCode('b')]))}               | ${'**`a`&ZeroWidthSpace;`b`**'}                 | ${bothSpans}
        ${list([[inlineCode('a'), inlineCode('b')]])}                           | ${'- `a`&ZeroWidthSpace;`b`'}                   | ${bothSpans}
        ${substitutePlaceholders(paragraph(placeholder('x'), inlineCode('b')), { x: inlineCode('a') })} | ${'`a`&ZeroWidthSpace;`b`'} | ${bothSpans}
    `('adjacent code spans stay apart: $expected', ({ value, expected, spans }: CodeSpansCase) => {
    const md = value.toString();
    assert.equal(md, expected);
    assert.deepEqual(codeSpans(md), spans);
  });

  test('adjacent code spans in a table cell stay apart', () => {
    const md = table(['T'], [[[inlineCode('string'), inlineCode('[]')]]]).toString();
    assert.equal(md.split('\n')[2], '| `string`&ZeroWidthSpace;`[]` |');
    assert.deepEqual(codeSpans(md), ['string', '[]']);
  });

  test('the separator reads back as a zero-width space', () => {
    const md = paragraph(inlineCode('a'), inlineCode('b')).toString();
    assert.deepEqual(readBack(md), ['inlineCode:a', 'text:\u200B', 'inlineCode:b']);
  });

  test('a separator given between code spans is not doubled', () => {
    const md = paragraph(inlineCode('a'), htmlEntity('ZeroWidthSpace'), inlineCode('b')).toString();
    assert.equal(md, '`a`&ZeroWidthSpace;`b`');
  });

  testEach`
        value                                                         | expected
        ${paragraph(strong(inlineCode('a')), inlineCode('b'))}        | ${'**`a`**`b`'}
        ${paragraph(emphasis(inlineCode('a')), inlineCode('b'))}      | ${'_`a`_`b`'}
        ${paragraph(strikethrough(inlineCode('a')), inlineCode('b'))} | ${'~~`a`~~`b`'}
        ${paragraph(link(inlineCode('a'), 'u'), inlineCode('b'))}     | ${'[`a`](u)`b`'}
        ${paragraph(inlineCode('a'), comment('x'), inlineCode('b'))}  | ${'`a`<!-- x -->`b`'}
        ${paragraph(inlineCode('a'), lineBreak(), inlineCode('b'))}   | ${'`a`\\\n`b`'}
    `(
    'code spans with a marker between them need no separator: $expected',
    ({ value, expected }: { value: MDElement; expected: string }) => {
      const md = value.toString();
      assert.equal(md, expected);
      assert.deepEqual(codeSpans(md), bothSpans);
    },
  );
});

interface CodeSpansCase {
  value: MDElement;
  expected: string;
  spans: string[];
}

/** Return the text of each code span in the Markdown, as a reader sees it. */
function codeSpans(md: string): string[] {
  const spans: string[] = [];
  visit(unified().use(remarkParse).use(remarkGfm).parse(md), 'inlineCode', (node) => {
    spans.push(node.value);
  });
  return spans;
}
