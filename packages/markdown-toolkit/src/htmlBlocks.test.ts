import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';
import { createUnindent } from '@streetsidesoftware/unindent';

import type { AnyContent, InlineContent } from './index.ts';
import {
  br,
  codeBlock,
  comment,
  definitionList,
  details,
  dl,
  document,
  htmlTable,
  inlineCode,
  lineBreak,
  link,
  list,
  listItem,
  paragraph,
  parse,
  placeholder,
  strong,
  substitutePlaceholders,
  text,
} from './index.ts';

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
    ${text('a\n\n  b ')}            | ${'<summary>a<br/><br/>b </summary>'}
    ${['Use ', text('<x>')]}        | ${'<summary>Use &lt;x></summary>'}
  `('summary text is HTML-escaped: $expected', ({ summary, expected }: { summary: string; expected: string }) => {
    assert.equal(details(summary).toString(), `<details>\n${expected}\n\n</details>`);
  });

  testEach`
    summary                                | expected
    ${['Use ', inlineCode('x')]}           | ${'Use `x`'}
    ${link('a]b', 'https://example.com')}  | ${'[a\\]b](https://example.com)'}
    ${placeholder('name')}                 | ${'{@ name @}'}
    ${comment('note')}                     | ${'<!-- note -->'}
  `(
    'a summary with Markdown has blank lines: $expected',
    ({ summary, expected }: { summary: InlineContent; expected: string }) => {
      assert.equal(
        details(summary, 'b').toString(),
        md`
          <details>
          <summary>

          ${expected}

          </summary>

          b

          </details>
        `,
      );
    },
  );

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

  test('a summary of empty formatting shows a space', () => {
    assert.equal(details(strong(''), '').toString(), '<details>\n<summary>\n\n**&#x20;**\n\n</summary>\n\n</details>');
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

  test('a term with Markdown has blank lines', () => {
    assert.equal(
      dl([[inlineCode('x'), 'y']]).toString(),
      md`
        <dl>

        <dt>

        \`x\`

        </dt>
        <dd>

        y

        </dd>

        </dl>
      `,
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
  test('plain-text cells are on one line, and a cell with Markdown has blank lines around it', () => {
    assert.equal(
      htmlTable(
        ['Option', 'Description'],
        [
          [inlineCode('--fix'), ['Fixes what it can:', list(['spelling', 'case'])]],
          ['plain', 'Stays on one line'],
        ],
      ).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th>Option</th>
        <th>Description</th>
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
        <td>plain</td>
        <td>Stays on one line</td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  testEach`
    content                          | expected
    ${'a < b & c > d'}               | ${'<td>a &lt; b &amp; c > d</td>'}
    ${'*not* emphasis | x'}          | ${'<td>*not* emphasis | x</td>'}
    ${'line one\nline two'}          | ${'<td>line one<br/>line two</td>'}
    ${'a \r\n b\n\nc'}               | ${'<td>a<br/>b<br/><br/>c</td>'}
    ${'\nedges\n'}                   | ${'<td>edges</td>'}
    ${text('a\nb')}                  | ${'<td>a<br/>b</td>'}
    ${['a', lineBreak(), 'b']}       | ${'<td>a<br/>b</td>'}
    ${parse('soft\nbreak')}          | ${'<td>soft\nbreak</td>'}
    ${''}                            | ${'<td></td>'}
    ${[]}                            | ${'<td></td>'}
  `('a plain-text cell: $expected', ({ content, expected }: { content: AnyContent; expected: string }) => {
    assert.equal(bodyCell(content), expected);
  });

  testEach`
    content                                  | expected
    ${['See ', inlineCode('x'), '\nnext']}   | ${'See `x`\\\nnext'}
    ${placeholder('name')}                   | ${'{@ name @}'}
    ${br()}                                  | ${'<br/>'}
    ${codeBlock('x', 'ts')}                  | ${'```ts\nx\n```'}
    ${[listItem('x'), listItem('y')]}        | ${'- x\n- y'}
  `('a cell with Markdown: $expected', ({ content, expected }: { content: AnyContent; expected: string }) => {
    assert.equal(bodyCell(content), `<td>\n\n${expected}\n\n</td>`);
  });

  test('every row is filled with empty cells to the widest row', () => {
    assert.equal(
      htmlTable(['Name', 'Size'], [['a.ts', '1 KB', 'extra'], ['b.ts']]).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th>Name</th>
        <th>Size</th>
        <th></th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td>a.ts</td>
        <td>1 KB</td>
        <td>extra</td>
        </tr>
        <tr>
        <td>b.ts</td>
        <td></td>
        <td></td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  test('an empty header leaves out <thead>', () => {
    assert.equal(htmlTable([], [['a']]).toString(), '<table>\n<tbody>\n<tr>\n<td>a</td>\n</tr>\n</tbody>\n</table>');
  });

  test('no rows', () => {
    assert.equal(htmlTable([], []).toString(), '<table>\n<tbody>\n</tbody>\n</table>');
  });

  test('align sets align on each cell of a column', () => {
    assert.equal(
      htmlTable(['A', 'B', 'C', 'D'], [['1', '2', [inlineCode('3')], '4']], {
        align: ['left', ':-:', '---:', '---'],
      }).toString(),
      md`
        <table>
        <thead>
        <tr>
        <th align="left">A</th>
        <th align="center">B</th>
        <th align="right">C</th>
        <th>D</th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td align="left">1</td>
        <td align="center">2</td>
        <td align="right">

        \`3\`

        </td>
        <td>4</td>
        </tr>
        </tbody>
        </table>
      `,
    );
  });

  test('an invalid alignment throws', () => {
    assert.throws(() => htmlTable(['A'], [], { align: ['up'] }), new Error('invalid column alignment: "up"'));
  });

  test('a placeholder in a cell is substituted', () => {
    const t = document(htmlTable(['Name'], [[placeholder('name')]]));
    assert.equal(
      substitutePlaceholders(t, { name: list(['a']) }).toString(),
      '<table>\n<thead>\n<tr>\n<th>Name</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>\n\n- a\n\n</td>\n</tr>\n</tbody>\n</table>\n',
    );
  });

  test('it goes in a document', () => {
    assert.equal(
      document('Intro', htmlTable([], [['a']])).toString(),
      'Intro\n\n<table>\n<tbody>\n<tr>\n<td>a</td>\n</tr>\n</tbody>\n</table>\n',
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
