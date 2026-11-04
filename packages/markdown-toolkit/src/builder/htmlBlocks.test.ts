import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';
import { createUnindent } from '@streetsidesoftware/unindent';

import {
  blockTemplate,
  br,
  codeBlock,
  comment,
  definitionList,
  details,
  dl,
  document,
  emphasis,
  htmlTable,
  inlineCode,
  inlineTemplate,
  lineBreak,
  link,
  list,
  listItem,
  paragraph,
  parse,
  placeholder,
  strikethrough,
  strong,
  substitutePlaceholders,
  sup,
  text,
} from '../index.ts';
import type { AnyContent, InlineContent } from '../index.ts';

const md = createUnindent({ trimFirstNewline: true, trimLastLine: true });

describe('details', () => {
  test('a plain-text summary is on one line, and the content has blank lines around it', () => {
    assert.equal(
      details('TypeScript:', codeBlock('{ a?: string }', 'ts')).toString(),
      md`
        <details>
        <summary>TypeScript:</summary>

        ${'```ts'}
        { a?: string }
        ${'```'}

        </details>
      `,
    );
  });

  testEach`
    summary                         | expected
    ${'a < b & c'}                  | ${'<summary>a &lt; b &amp; c</summary>'}
    ${'*not* emphasis'}             | ${'<summary>*not* emphasis</summary>'}
    ${['Use ', text('<x>')]}        | ${'<summary>Use &lt;x></summary>'}
  `('summary text is HTML-escaped: $expected', ({ summary, expected }: { summary: string; expected: string }) => {
    assert.equal(details(summary).toString(), `<details>\n${expected}\n\n</details>`);
  });

  testEach`
    summary                  | expected
    ${text('a\n\n  b ')}     | ${'<summary>a<br/><br/>b</summary>'}
    ${'  a  '}               | ${'<summary>a</summary>'}
    ${'\na\n'}               | ${'<summary>a</summary>'}
    ${'\t\n \n'}             | ${'<summary></summary>'}
  `(
    'a summary keeps its line breaks, without the spaces, tabs and line breaks at its edges: $expected',
    ({ summary, expected }: { summary: InlineContent; expected: string }) => {
      assert.equal(details(summary).toString(), `<details>\n${expected}\n\n</details>`);
    },
  );

  test('a term and a cell lose the spaces and tabs at their edges', () => {
    assert.equal(dl([['  a\t', 'b']]).toString(), '<dl>\n\n<dt>a</dt>\n<dd>\n\nb\n\n</dd>\n\n</dl>');
    assert.equal(
      htmlTable(['  a  '], [[' b ']]).toString(),
      '<table>\n<thead>\n<tr>\n<th>\n\na\n\n</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>\n\nb\n\n</td>\n</tr>\n</tbody>\n</table>',
    );
  });

  testEach`
    summary                                                | expected
    ${['CSpell Settings ', inlineCode('cspell.json')]}     | ${'CSpell Settings <code>cspell.json</code>'}
    ${inlineCode('a < b & c')}                             | ${'<code>a &lt; b &amp; c</code>'}
    ${inlineCode('a\nb')}                                  | ${'<code>a b</code>'}
    ${inlineCode('a\r\nb')}                                | ${'<code>a b</code>'}
    ${inlineCode('')}                                      | ${'<code> </code>'}
    ${[inlineCode('a'), inlineCode('b')]}                  | ${'<code>a</code><code>b</code>'}
    ${strong('a')}                                         | ${'<strong>a</strong>'}
    ${strong('')}                                          | ${'<strong> </strong>'}
    ${emphasis('a < b')}                                   | ${'<em>a &lt; b</em>'}
    ${strikethrough('a')}                                  | ${'<del>a</del>'}
    ${sup(inlineCode('a'))}                                | ${'<sup><code>a</code></sup>'}
    ${strong(['a', lineBreak(), 'b'])}                     | ${'<strong>a<br/>b</strong>'}
    ${strong(['a ', lineBreak(), ' b'])}                   | ${'<strong>a<br/>b</strong>'}
    ${[strong(['a', lineBreak()]), 'b']}                   | ${'<strong>a<br/></strong>b'}
    ${strong(['a', lineBreak()])}                          | ${'<strong>a</strong>'}
    ${['x ', strong(' a '), ' y']}                         | ${'x <strong> a </strong> y'}
    ${strong(emphasis(inlineCode('a')))}                   | ${'<strong><em><code>a</code></em></strong>'}
    ${link('a]b', 'https://example.com')}                  | ${'<a href="https://example.com">a]b</a>'}
    ${link(inlineCode('a'), 'https://a.b/?c=1&d="e"')}     | ${'<a href="https://a.b/?c=1&amp;d=&quot;e&quot;"><code>a</code></a>'}
    ${link('a', '')}                                       | ${'<a href="">a</a>'}
    ${inlineTemplate('[a](b "c")', {})}                    | ${'<a href="b" title="c">a</a>'}
    ${inlineTemplate('![a "b"](c.png "d")', {})}           | ${'<img src="c.png" alt="a &quot;b&quot;" title="d"/>'}
    ${inlineTemplate('![a](b.png)', {})}                   | ${'<img src="b.png" alt="a"/>'}
    ${['a', br(), 'b']}                                    | ${'a<br/>b'}
    ${comment('note')}                                     | ${'<!-- note -->'}
  `(
    'a summary with inline elements is HTML on one line: $expected',
    ({ summary, expected }: { summary: InlineContent; expected: string }) => {
      assert.equal(details(summary, 'b').toString(), `<details>\n<summary>${expected}</summary>\n\nb\n\n</details>`);
    },
  );

  testEach`
    summary                                         | expected
    ${placeholder('name')}                          | ${'{@ name @}'}
    ${['Use ', placeholder('name')]}                | ${'Use {@ name @}'}
    ${strong(placeholder('name'))}                  | ${'<strong>{@ name @}</strong>'}
    ${link(strong(placeholder('name')), 'u')}       | ${'<a href="u"><strong>{@ name @}</strong></a>'}
    ${sup(placeholder('name'))}                     | ${'<sup>{@ name @}</sup>'}
    ${inlineCode('{@ name @}')}                     | ${'<code>{@ name @}</code>'}
    ${link('a', '{@ name @}')}                      | ${'<a href="{@ name @}">a</a>'}
    ${inlineTemplate('[a](b "{@ name @}")', {})}    | ${'<a href="b" title="{@ name @}">a</a>'}
    ${inlineTemplate('![{@ name @}](b.png)', {})}   | ${'<img src="b.png" alt="{@ name @}"/>'}
    ${comment('{@ name @}')}                        | ${'<!-- {@ name @} -->'}
  `(
    'a placeholder with no value is treated as text: $expected',
    ({ summary, expected }: { summary: InlineContent; expected: string }) => {
      assert.equal(details(summary, 'b').toString(), `<details>\n<summary>${expected}</summary>\n\nb\n\n</details>`);
    },
  );

  testEach`
    summary                         | value                 | expected
    ${placeholder('x')}             | ${'a'}                | ${'a'}
    ${placeholder('x')}             | ${'  a  '}            | ${'a'}
    ${placeholder('x')}             | ${'a < b & c'}        | ${'a &lt; b &amp; c'}
    ${placeholder('x')}             | ${''}                 | ${''}
    ${placeholder('x')}             | ${'a\nb'}             | ${'a<br/>b'}
    ${placeholder('x')}             | ${strong('a')}        | ${'<strong>a</strong>'}
    ${placeholder('x')}             | ${inlineCode('a')}    | ${'<code>a</code>'}
    ${placeholder('x')}             | ${placeholder('y')}   | ${'{@ y @}'}
    ${['Use ', placeholder('x')]}   | ${link('a', 'u')}     | ${'Use <a href="u">a</a>'}
    ${strong(placeholder('x'))}     | ${emphasis('a')}      | ${'<strong><em>a</em></strong>'}
    ${inlineCode('{@ x @}')}        | ${'a<b'}              | ${'<code>a&lt;b</code>'}
    ${link('a', '{@ x @}')}         | ${'https://a.b/?c&d'} | ${'<a href="https://a.b/?c&amp;d">a</a>'}
    ${comment('{@ x @}')}           | ${'a'}                | ${'<!-- a -->'}
  `(
    'a substituted summary is the same as one given the value: $expected',
    ({ summary, value, expected }: { summary: InlineContent; value: never; expected: string }) => {
      assert.equal(
        substitutePlaceholders(document(details(summary, 'b')), { x: value }).toString(),
        `<details>\n<summary>${expected}</summary>\n\nb\n\n</details>\n`,
      );
    },
  );

  test('a placeholder in a summary takes only inline values', () => {
    assert.throws(
      () => substitutePlaceholders(document(details(placeholder('x'), 'b')), { x: list(['a']) }),
      /\{@ x @\}/,
    );
  });

  test('a summary with a multi-line comment throws', () => {
    assert.throws(
      () => details(comment('a\nb'), 'c'),
      new TypeError('details summary must be inline, got a multi-line comment'),
    );
  });

  test('it goes in a list item', () => {
    assert.equal(
      list([listItem(details(inlineCode('s'), 'b'))]).toString(),
      '- <details>\n  <summary><code>s</code></summary>\n\n  b\n  </details>',
    );
  });

  test('it goes in a table cell', () => {
    assert.equal(
      bodyCell(details(inlineCode('s'), 'b')),
      '<td>\n\n<details>\n<summary><code>s</code></summary>\n\nb\n\n</details>\n\n</td>',
    );
  });

  test('inline content is a paragraph, and blocks follow', () => {
    assert.equal(
      details('S', ['See ', inlineCode('x'), '.'], list(['a'])).toString(),
      md`
        <details>
        <summary>S</summary>

        See \`x\`.

        - a

        </details>
      `,
    );
  });

  test('it goes in a document', () => {
    assert.equal(
      document('Intro', details('S', 'b')).toString(),
      md`
        Intro

        <details>
        <summary>S</summary>

        b

        </details>
      ` + '\n',
    );
  });

  test('an empty paragraph in the content adds no blank lines', () => {
    assert.equal(details('s', paragraph('')).toString(), '<details>\n<summary>s</summary>\n\n</details>');
  });

  test('a block summary throws', () => {
    assert.throws(() => details(list(['a']) as never), new TypeError('details summary must be inline, got a list'));
  });
});

describe('definitionList', () => {
  test('plain-text terms are on one line, and definitions have blank lines around them', () => {
    assert.equal(
      definitionList([
        ['Name', inlineCode('cSpell.dark')],
        ['Description', parse('Decoration.\n\n- [a](b.md)\n')],
      ]).toString(),
      md`
        <dl>

        <dt>Name</dt>
        <dd>

        \`cSpell.dark\`

        </dd>

        <dt>Description</dt>
        <dd>

        Decoration.

        - [a](b.md)

        </dd>

        </dl>
      `,
    );
  });

  test('term text is HTML-escaped', () => {
    assert.equal(
      dl([['a < b & c', 'd']]).toString(),
      md`
        <dl>

        <dt>a &lt; b &amp; c</dt>
        <dd>

        d

        </dd>

        </dl>
      `,
    );
  });

  test('definition text is Markdown-escaped', () => {
    assert.equal(
      dl([['T', '*not* emphasis']]).toString(),
      md`
        <dl>

        <dt>T</dt>
        <dd>

        ${'\\*not\\* emphasis'}

        </dd>

        </dl>
      `,
    );
  });

  test('a term with inline elements is HTML on one line', () => {
    assert.equal(
      dl([[['Use ', inlineCode('x')], 'y']]).toString(),
      md`
        <dl>

        <dt>Use <code>x</code></dt>
        <dd>

        y

        </dd>

        </dl>
      `,
    );
  });

  test('a term with a placeholder stays on one line, with or without a value', () => {
    const terms = dl([[strong(placeholder('x')), 'y']]);
    assert.equal(terms.toString(), '<dl>\n\n<dt><strong>{@ x @}</strong></dt>\n<dd>\n\ny\n\n</dd>\n\n</dl>');
    assert.equal(
      substitutePlaceholders(document(terms), { x: emphasis('a') }).toString(),
      '<dl>\n\n<dt><strong><em>a</em></strong></dt>\n<dd>\n\ny\n\n</dd>\n\n</dl>\n',
    );
  });

  test('a definition can mix inline and blocks', () => {
    assert.equal(
      dl([['T', ['See ', inlineCode('x'), list(['a'])]]]).toString(),
      md`
        <dl>

        <dt>T</dt>
        <dd>

        See \`x\`

        - a

        </dd>

        </dl>
      `,
    );
  });

  test('no entries', () => {
    assert.equal(dl([]).toString(), '<dl>\n\n</dl>');
  });

  test('a block term throws', () => {
    assert.throws(() => dl([[list(['a']) as never, 'b']]), new TypeError('definition term must be inline, got a list'));
  });

  test('an entry that is not a pair throws', () => {
    assert.throws(
      () => dl(['Name' as never]),
      new TypeError('definition list entry must be a [term, definition] pair, got a string'),
    );
  });
});

describe('htmlTable', () => {
  test('every cell has blank lines around its content', () => {
    assert.equal(
      htmlTable(
        ['Option', 'Description'],
        [
          [inlineCode('--fix'), ['Fixes what it can:', list(['spelling', 'case'])]],
          ['plain', ''],
        ],
      ).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th>

        Option

        </th>
        <th>

        Description

        </th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td>

        \`--fix\`

        </td>
        <td>

        Fixes what it can:

        - spelling
        - case

        </td>
        </tr>
        <tr>
        <td>

        plain

        </td>
        <td></td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  testEach`
    content                                  | expected
    ${'a < b & c > d'}                       | ${'a < b & c > d'}
    ${'*not* emphasis | x'}                  | ${'\\*not\\* emphasis | x'}
    ${'line one\nline two'}                  | ${'line one\\\nline two'}
    ${'a \r\n b\n\nc'}                       | ${'a\\\nb\\\n\\\nc'}
    ${'\nedges\n'}                           | ${'edges'}
    ${text('a\nb')}                          | ${'a\\\nb'}
    ${['a', lineBreak(), 'b']}               | ${'a\\\nb'}
    ${parse('soft\nbreak')}                  | ${'soft\nbreak'}
    ${['See ', inlineCode('x'), '\nnext']}   | ${'See `x`\\\nnext'}
    ${strong(link('a', 'https://a.b'))}      | ${'**[a](https://a.b)**'}
    ${br()}                                  | ${'<br/>'}
    ${placeholder('name')}                   | ${'{@ name @}'}
    ${strong(placeholder('name'))}           | ${'**{@ name @}**'}
    ${codeBlock('x', 'ts')}                  | ${'```ts\nx\n```'}
    ${[listItem('x'), listItem('y')]}        | ${'- x\n- y'}
  `('a cell holds Markdown: $expected', ({ content, expected }: { content: AnyContent; expected: string }) => {
    assert.equal(bodyCell(content), `<td>\n\n${expected}\n\n</td>`);
  });

  testEach`
    content
    ${''}
    ${'  '}
    ${[]}
  `('an empty cell has no blank lines: $content', ({ content }: { content: AnyContent }) => {
    assert.equal(bodyCell(content), '<td></td>');
  });

  test('every row is filled with empty cells to the widest row', () => {
    assert.equal(
      htmlTable(['Name'], [['a', 'b'], []]).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th>

        Name

        </th>
        <th></th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td>

        a

        </td>
        <td>

        b

        </td>
        </tr>
        <tr>
        <td></td>
        <td></td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  test('an empty header leaves out <thead>', () => {
    assert.equal(htmlTable([], [['']]).toString(), '<table>\n<tbody>\n<tr>\n<td></td>\n</tr>\n</tbody>\n</table>');
  });

  test('no rows', () => {
    assert.equal(htmlTable([], []).toString(), '<table>\n<tbody>\n</tbody>\n</table>');
  });

  test('align sets align on each cell of a column', () => {
    assert.equal(
      htmlTable(['', '', '', ''], [['', '', inlineCode('3'), '']], {
        align: ['left', ':-:', '---:', '---'],
      }).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th align="left"></th>
        <th align="center"></th>
        <th align="right"></th>
        <th></th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td align="left"></td>
        <td align="center"></td>
        <td align="right">

        \`3\`

        </td>
        <td></td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  test('an invalid alignment throws', () => {
    assert.throws(() => htmlTable(['A'], [], { align: ['up'] }), new Error('invalid column alignment: "up"'));
  });

  testEach`
    value              | expected
    ${'a < b'}         | ${'<td>\n\na < b\n\n</td>'}
    ${strong('a')}     | ${'<td>\n\n**a**\n\n</td>'}
    ${list(['a'])}     | ${'<td>\n\n- a\n\n</td>'}
  `(
    'a placeholder in a cell takes any value, before or after toString: $expected',
    ({ value, expected }: { value: never; expected: string }) => {
      const table = document(htmlTable([], [[placeholder('x')]]));
      const page = `<table>\n<tbody>\n<tr>\n${expected}\n</tr>\n</tbody>\n</table>`;
      assert.equal(substitutePlaceholders(table, { x: value }).toString(), `${page}\n`);
      assert.equal(blockTemplate(table.toString(), { x: value }).toString(), page);
    },
  );

  test('a placeholder in a cell with an empty value leaves the cell empty', () => {
    assert.equal(
      substitutePlaceholders(document(htmlTable([], [[placeholder('x')]])), { x: '' }).toString(),
      '<table>\n<tbody>\n<tr>\n<td></td>\n</tr>\n</tbody>\n</table>\n',
    );
  });

  test('it goes in a document', () => {
    assert.equal(
      document('Intro', htmlTable([], [['a']])).toString(),
      'Intro\n\n<table>\n<tbody>\n<tr>\n<td>\n\na\n\n</td>\n</tr>\n</tbody>\n</table>\n',
    );
  });

  testEach`
    header            | rows              | message
    ${'A'}            | ${[]}             | ${'table header must be an array, got a string'}
    ${['A']}          | ${'a'}            | ${'table rows must be an array, got a string'}
    ${['A']}          | ${['a']}          | ${'table row must be an array, got a string'}
  `('bad input throws: $message', ({ header, rows, message }: { header: never; rows: never; message: string }) => {
    assert.throws(() => htmlTable(header, rows), new TypeError(message));
  });
});

/** Render a one-cell table with no header, and return its cell. */
function bodyCell(content: AnyContent): string {
  return htmlTable([], [[content]])
    .toString()
    .replace(/^<table>\n<tbody>\n<tr>\n/, '')
    .replace(/\n<\/tr>\n<\/tbody>\n<\/table>$/, '');
}
