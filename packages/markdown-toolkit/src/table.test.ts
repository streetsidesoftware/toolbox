import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import type { ColumnAlign, InlineContent } from './index.ts';
import {
  br,
  document,
  heading,
  inlineCode,
  lineBreak,
  link,
  list,
  placeholder,
  strong,
  substitutePlaceholders,
  table,
  template,
  text,
} from './index.ts';

/** Render a one-column table, and return its body row. */
function cell(content: InlineContent): string {
  return table(['A'], [[content]])
    .toString()
    .split('\n')[2];
}

describe('table', () => {
  test('a header and rows, padded so the pipes line up', () => {
    assert.equal(
      table(
        ['Source', 'License'],
        [
          ['Hunspell', link('LICENSE', 'https://example.com/LICENSE')],
          ['by hand', ''],
        ],
      ).toString(),
      [
        '| Source   | License                                |',
        '| -------- | -------------------------------------- |',
        '| Hunspell | [LICENSE](https://example.com/LICENSE) |',
        '| by hand  |                                        |',
      ].join('\n'),
    );
  });

  testEach`
    content                                          | expected
    ${'a|b'}                                         | ${'| a\\|b |'}
    ${inlineCode('a|b')}                             | ${'| `a\\|b` |'}
    ${link('a|b', 'https://example.com/?q=a|b')}     | ${'| [a\\|b](https://example.com/?q=a\\|b) |'}
    ${link(inlineCode('x|y'), 'https://e.com')}      | ${'| [`x\\|y`](https://e.com) |'}
    ${strong('a|b')}                                 | ${'| **a\\|b** |'}
    ${text('*a* | [b]')}                             | ${'| \\*a\\* \\| \\[b] |'}
  `(
    'a `|` is escaped wherever it lands: $expected',
    ({ content, expected }: { content: InlineContent; expected: string }) => {
      assert.equal(cell(content).replace(/ +\|$/, ' |'), expected);
    },
  );

  testEach`
    content                                        | expected
    ${['a', lineBreak(), 'b']}                     | ${'a<br/>b'}
    ${strong(['a', lineBreak(), 'b'])}             | ${'**a<br/>b**'}
    ${['a', br(), 'b']}                            | ${'a<br/>b'}
    ${[lineBreak(), 'a', lineBreak()]}             | ${'a'}
    ${'\na\n'}                                     | ${'a'}
    ${'a\nb\r\nc'}                                 | ${'a<br/>b<br/>c'}
    ${inlineCode('a\nb')}                          | ${'`a b`'}
  `('a cell stays on one line: $expected', ({ content, expected }: { content: InlineContent; expected: string }) => {
    assert.equal(cell(content), `| ${expected} |`);
  });

  testEach`
    align                                          | expected
    ${['left', 'center', 'right', undefined]}      | ${'| :- | :-: | -: | - |'}
    ${[':-', ':-:', '-:', '-']}                    | ${'| :- | :-: | -: | - |'}
    ${[':---', ':--:', '---:', '---']}             | ${'| :- | :-: | -: | - |'}
    ${['right']}                                   | ${'| -: | - | - | - |'}
    ${[]}                                          | ${'| - | - | - | - |'}
  `('alignment $align', ({ align, expected }: { align: ColumnAlign[]; expected: string }) => {
    const delimiter = table(['a', 'b', 'c', 'd'], [], { align }).toString().split('\n')[1];
    assert.equal(delimiter.replace(/-+/g, '-'), expected);
  });

  test('without options, no column is aligned', () => {
    assert.equal(table(['a', 'b'], []).toString(), '| a | b |\n| - | - |');
  });

  testEach`
    align
    ${':'}
    ${'--:-'}
    ${'middle'}
  `('an invalid alignment throws: $align', ({ align }: { align: ColumnAlign }) => {
    assert.throws(() => table(['a'], [], { align: [align] }), { name: 'Error', message: /invalid column alignment/ });
  });

  test('a short row is padded with empty cells, and a long row adds a column', () => {
    assert.equal(
      table(['A', 'B'], [['1', '', '3'], ['x']]).toString(),
      ['| A | B |   |', '| - | - | - |', '| 1 |   | 3 |', '| x |   |   |'].join('\n'),
    );
  });

  test('a placeholder in a cell is kept, and substituted later like any other', () => {
    const t = table(['Name'], [[placeholder('name')]]);
    assert.equal(t.toString(), '| Name       |\n| ---------- |\n| {@ name @} |');
    const value = ['a', lineBreak(), inlineCode('b|c')];
    const substituted = '| Name         |\n| ------------ |\n| a<br/>`b\\|c` |';
    assert.equal(substitutePlaceholders(t, { name: value }).toString(), substituted);
    assert.equal(template('| Name |\n| - |\n| {@ name @} |', { name: value }).toString(), substituted);
  });

  test('a table is a block in a document', () => {
    assert.equal(
      document(heading(2, 'Sources'), table(['A'], [['1']])).toString(),
      '## Sources\n\n| A |\n| - |\n| 1 |\n',
    );
  });

  testEach`
    header            | rows              | message
    ${'A'}            | ${[]}             | ${'table header must be an array, got a string'}
    ${['A']}          | ${'x'}            | ${'table rows must be an array, got a string'}
    ${['A']}          | ${['x']}          | ${'table row must be an array, got a string'}
    ${['A']}          | ${[[list([])]]}   | ${'table cell must be inline, got a list'}
  `(
    'wrong content throws a TypeError: $message',
    ({ header, rows, message }: { header: never; rows: never; message: string }) => {
      assert.throws(() => table(header, rows), { name: 'TypeError', message });
    },
  );
});
