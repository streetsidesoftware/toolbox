import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockComment,
  blockTemplate,
  br,
  comment,
  details,
  dl,
  document,
  heading,
  htmlTable,
  inlineComment,
  inlineTemplate,
  lineBreak,
  list,
  listItem,
  paragraph,
  parse,
  substitutePlaceholders,
  template,
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

describe('comment chooses its form from its text', () => {
  testEach`
    text        | kind        | expected
    ${'a'}      | ${'inline'} | ${'<!-- a -->'}
    ${' a '}    | ${'inline'} | ${'<!--  a  -->'}
    ${'a\nb'}   | ${'block'}  | ${'<!--\na\nb\n-->'}
    ${'a\r\nb'} | ${'block'}  | ${'<!--\na\r\nb\n-->'}
    ${'a\rb'}   | ${'block'}  | ${'<!--\na\rb\n-->'}
    ${'a\n'}    | ${'block'}  | ${'<!--\na\n\n-->'}
    ${'\na'}    | ${'block'}  | ${'<!--\n\na\n-->'}
  `('$expected', ({ text, kind, expected }: { text: string; kind: string; expected: string }) => {
    const element = comment(text);
    assert.equal(element.kind, kind);
    assert.equal(element.type, 'comment');
    assert.equal(element.toString(), expected);
  });

  test('a multi-line comment goes on its own lines', () => {
    assert.equal(document('a', comment('b\nc'), 'd').toString(), 'a\n\n<!--\nb\nc\n-->\n\nd\n');
  });

  test('a multi-line comment throws where only inline content goes', () => {
    assert.throws(() => paragraph('a', comment('b\nc')), new TypeError('paragraph content must be inline'));
    assert.throws(() => dl([[comment('a\nb'), 'c']]), new TypeError('definition term must be inline'));
    assert.throws(() => heading(1, comment('a\nb')), new TypeError('heading content must be inline'));
  });

  test('a multi-line comment as a replacement throws in a sentence', () => {
    assert.throws(() => inlineTemplate('a {@ x @} b', { x: comment('c\nd') }), new TypeError('{@ x @} must be inline'));
  });

  test('the form comes from the text given, and a replacement goes in as given', () => {
    const substituted = substitutePlaceholders(paragraph('a ', comment('{@ x @}')), { x: 'y\nz' });
    assert.equal(substituted.toString(), 'a <!-- y\nz -->');
    assert.equal(substitutePlaceholders(comment('{@ x @}'), { x: 'y\nz' }).kind, 'inline');
  });

  test('a comment with a line ending stays a block after substitution', () => {
    const substituted = substitutePlaceholders(comment('a\n{@ x @}'), { x: 'y' });
    assert.equal(substituted.kind, 'block');
    assert.equal(substituted.toString(), '<!--\na\ny\n-->');
  });

  test('a multi-line comment as a replacement goes on its own lines', () => {
    assert.equal(template('x\n{@ v @}\ny', { v: comment('a\nb') }).toString(), 'x\n\n<!--\na\nb\n-->\n\ny');
  });

  test('a replacement goes in a summary as given', () => {
    const page = details(comment('{@ x @}'), 'b');
    assert.equal(
      substitutePlaceholders(page, { x: 'y\n\nz' }).toString(),
      '<details>\n<summary><!-- y\n\nz --></summary>\n\nb\n\n</details>',
    );
  });
});

describe('a comment reads back as written', () => {
  testEach`
    value
    ${document(paragraph('a'), inlineComment('b'), paragraph('c'))}
    ${document(paragraph('a'), blockComment('b\n\nc'), paragraph('d'))}
    ${document(paragraph('a'), comment('b\r\nc'), paragraph('d'))}
    ${list([listItem('a', comment('b\r\nc'), 'd')])}
    ${details(inlineComment('a'), blockComment('b'))}
    ${dl([[inlineComment('a'), blockComment('b')]])}
    ${htmlTable(['h'], [[blockComment('a\n\nb')]])}
  `('$value', ({ value }: { value: MDElement }) => {
    const written = value.toString().trimEnd();
    assert.equal(parse(written).toString(), written);
  });
});

describe('inlineComment', () => {
  test('it is on one line, inside a line', () => {
    assert.equal(paragraph('a ', inlineComment('c'), ' b').toString(), 'a <!-- c --> b');
    assert.equal(
      details(inlineComment('c'), 'b').toString(),
      '<details>\n<summary><!-- c --></summary>\n\nb\n\n</details>',
    );
  });

  test('it goes on its own line between paragraphs', () => {
    assert.equal(document(paragraph('a'), inlineComment('c'), paragraph('b')).toString(), 'a\n\n<!-- c -->\n\nb\n');
  });

  test("its text can't end the comment early", () => {
    assert.equal(inlineComment('a --> b --!> c').toString(), '<!-- a -- > b -- !> c -->');
  });

  test('a replacement goes in as given, even with a line ending', () => {
    assert.equal(substitutePlaceholders(inlineComment('{@ x @}'), { x: 'y\nz' }).toString(), '<!-- y\nz -->');
  });

  testEach`
    text
    ${'a\nb'}
    ${'a\r\nb'}
    ${'a\rb'}
    ${'a\n'}
  `('a line ending throws: $text', ({ text }: { text: string }) => {
    assert.throws(
      () => inlineComment(text),
      new TypeError("inlineComment text can't have a line ending; use blockComment"),
    );
  });
});

describe('blockComment', () => {
  testEach`
    text              | expected
    ${'a'}            | ${'<!--\na\n-->'}
    ${'a\nb'}         | ${'<!--\na\nb\n-->'}
    ${'a\n\nb'}       | ${'<!--\na\n\nb\n-->'}
    ${'a\n \nb'}      | ${'<!--\na\n \nb\n-->'}
    ${'a\n'}          | ${'<!--\na\n\n-->'}
    ${' a '}          | ${'<!--\n a \n-->'}
    ${'a --> b'}      | ${'<!--\na -- > b\n-->'}
  `('$expected', ({ text, expected }: { text: string; expected: string }) => {
    assert.equal(blockComment(text).toString(), expected);
  });

  test('it goes between blocks, and a blank line stays in the comment', () => {
    assert.equal(
      document(paragraph('a'), blockComment('b\n\nc'), paragraph('d')).toString(),
      'a\n\n<!--\nb\n\nc\n-->\n\nd\n',
    );
  });

  test('it goes in a list item, a table cell and details', () => {
    assert.equal(list([listItem('a', blockComment('b'))]).toString(), '- a\n  <!--\n  b\n  -->');
    assert.equal(
      htmlTable(['h'], [[blockComment('a')]]).toString(),
      '<table>\n<thead>\n<tr>\n<th>\n\nh\n\n</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>\n\n<!--\na\n-->\n\n</td>\n</tr>\n</tbody>\n</table>',
    );
    assert.equal(
      details('s', blockComment('a')).toString(),
      '<details>\n<summary>s</summary>\n\n<!--\na\n-->\n\n</details>',
    );
  });

  test('its placeholder takes a replacement with several lines', () => {
    assert.equal(substitutePlaceholders(blockComment('{@ x @}'), { x: 'y\nz' }).toString(), '<!--\ny\nz\n-->');
  });

  test('it goes on its own line as a replacement', () => {
    assert.equal(blockTemplate('a\n\n{@ x @}\n\nb', { x: blockComment('c') }).toString(), 'a\n\n<!--\nc\n-->\n\nb');
  });

  test('it throws where only inline content goes', () => {
    assert.throws(
      // @ts-expect-error a block comment isn't inline content.
      () => paragraph(blockComment('a')),
      new TypeError('paragraph content must be inline'),
    );
    assert.throws(
      // @ts-expect-error a block comment isn't inline content.
      () => details(blockComment('a'), 'b'),
      new TypeError('details summary must be inline'),
    );
  });
});
