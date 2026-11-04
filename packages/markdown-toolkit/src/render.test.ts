import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockPlaceholder,
  blockText,
  br,
  codeBlock,
  comment,
  definitionList,
  details,
  document,
  emphasis,
  heading,
  inlineCode,
  lineBreak,
  link,
  list,
  listItem,
  paragraph,
  placeholder,
  strikethrough,
  strong,
  substitutePlaceholders,
  table,
  template,
  text,
} from './index.ts';
import type { MDElement } from './index.ts';

describe('escaping', () => {
  testEach`
        value                                               | expected
        ${link('a]b[c', '../a.md')}                         | ${'[a\\]b\\[c](../a.md)'}
        ${link(inlineCode('@cspell/dict-en'), '../en')}     | ${'[`@cspell/dict-en`](../en)'}
        ${link('docs', new URL('https://example.com/a b'))} | ${'[docs](https://example.com/a%20b)'}
        ${inlineCode('a`b')}                                | ${'``a`b``'}
        ${text('*not* emphasis')}                           | ${'\\*not\\* emphasis'}
        ${comment('a --> b')}                               | ${'<!-- a -- > b -->'}
        ${comment('cspell:disable')}                        | ${'<!-- cspell:disable -->'}
    `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('a code block fence is longer than any fence in the code', () => {
    assert.equal(codeBlock('```js\nx\n```', 'md').toString(), '````md\n```js\nx\n```\n````');
  });

  test('block syntax at the start of an item is escaped', () => {
    assert.equal(list(['- not a list', '1. not ordered']).toString(), '- \\- not a list\n- 1\\. not ordered');
  });
});

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

describe('a newline in a string is a line break', () => {
  testEach`
    value                                                           | expected
    ${paragraph('a\nb')}                                            | ${'a\\\nb'}
    ${paragraph('a\r\nb\rc')}                                       | ${'a\\\nb\\\nc'}
    ${paragraph('a \t\n  b')}                                       | ${'a\\\nb'}
    ${paragraph('First.\n\nSecond.')}                               | ${'First.\\\n\\\nSecond.'}
    ${paragraph(text('a\nb'))}                                      | ${'a\\\nb'}
    ${paragraph(link('a\nb', 'https://example.com'))}               | ${'[a\\\nb](https://example.com)'}
    ${paragraph(strong('a\nb'), emphasis('c\nd'), strikethrough('e\nf'))} | ${'**a\\\nb**_c\\\nd_~~e\\\nf~~'}
    ${template('x {@ v @} y', { v: 'a\nb' })}                       | ${'x a\\\nb y'}
    ${table(['h'], [['a\nb']])}                                     | ${'| h       |\n| ------- |\n| a<br/>b |'}
    ${details('a\nb', 'c')}                                         | ${'<details>\n<summary>a<br/>b</summary>\n\nc\n\n</details>'}
    ${definitionList([['a\nb', 'c']])}                              | ${'<dl>\n\n<dt>a<br/>b</dt>\n<dd>\n\nc\n\n</dd>\n\n</dl>'}
    ${document('a', '\nb')}                                         | ${'a\\\nb\n'}
    ${paragraph(inlineCode('a\nb'))}                                | ${'`a\nb`'}
    ${blockText('a\nb')}                                            | ${'a\nb'}
  `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  testEach`
    value                                                 | expected
    ${paragraph(['a ', '\nb'])}                           | ${'a\\\nb'}
    ${paragraph(['a\n', ' b'])}                           | ${'a\\\nb'}
    ${paragraph(['a ', lineBreak(), ' b'])}               | ${'a\\\nb'}
    ${paragraph(strong(['a ', lineBreak(), '\tb']))}      | ${'**a\\\nb**'}
    ${heading(3, ['a ', lineBreak(), ' b'])}              | ${'### a<br/>b'}
    ${template('a {@ x @} b', { x: 'c\n' })}              | ${'a c\\\nb'}
    ${details(['a ', '\n b'], 'c')}                       | ${'<details>\n<summary>a<br/>b</summary>\n\nc\n\n</details>'}
    ${paragraph([strong('a '), lineBreak(), 'b'])}        | ${'**a**\\\nb'}
    ${paragraph(['a', lineBreak(), emphasis('\tb')])}     | ${'a\\\n_b_'}
    ${paragraph([strong(emphasis('a ')), '\nb'])}         | ${'**_a_**\\\nb'}
  `(
    'the spaces and tabs next to a line break go, wherever they come from: $expected',
    ({ value, expected }: { value: MDElement; expected: string }) => {
      assert.equal(value.toString(), expected);
    },
  );

  test('in a heading, a line break is <br/> at every depth', () => {
    for (const depth of [1, 2, 3, 4, 5, 6] as const) {
      const hashes = '#'.repeat(depth);
      assert.equal(heading(depth, 'a\nb').toString(), `${hashes} a<br/>b`);
      assert.equal(heading(depth, ['a', lineBreak(), 'b']).toString(), `${hashes} a<br/>b`);
    }
  });
});

describe('line endings at the edges', () => {
  testEach`
        value                                                                  | expected
        ${document('Fruit:\n', placeholder('fruit'), '\n')}                    | ${'Fruit:\\\n{@ fruit @}\n'}
        ${document(document('Fruit:\n', placeholder('fruit'), '\n'), 'yummy')} | ${'Fruit:\\\n{@ fruit @}\n\nyummy\n'}
        ${document('Fruit:\n', blockPlaceholder('fruit'))}                     | ${'Fruit:\n\n{@ fruit @}\n'}
        ${document('Intro', '\n', list(['x']))}                                | ${'Intro\n\n- x\n'}
        ${list([listItem('Langs\n', list(['en']))])}                           | ${'- Langs\n  - en'}
        ${paragraph('\n\na\nb\nc  \n\n')}                                      | ${'a\\\nb\\\nc'}
        ${heading(2, 'Title\n')}                                               | ${'## Title'}
        ${paragraph('a', lineBreak())}                                         | ${'a'}
        ${paragraph(lineBreak(), 'a', lineBreak(), 'b')}                       | ${'a\\\nb'}
        ${document('Fruit:\n', placeholder('fruit'), '\n', 'yummy')}           | ${'Fruit:\\\n{@ fruit @}\\\nyummy\n'}
    `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });
});
