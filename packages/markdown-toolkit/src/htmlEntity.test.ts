import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  copy,
  details,
  document,
  emsp,
  ensp,
  heading,
  hellip,
  htmlEntity,
  htmlTable,
  link,
  mdash,
  nbsp,
  ndash,
  paragraph,
  shy,
  strong,
  substitutePlaceholders,
  table,
  template,
  templateDocument,
  thinsp,
} from './index.ts';
import type { MDElement, MDHtmlEntity } from './index.ts';

interface EntityRow {
  value: string;
  expected: string;
  character: string;
}

describe('htmlEntity', () => {
  testEach`
    value         | expected      | character
    ${'\u00A0'}   | ${'&nbsp;'}   | ${'\u00A0'}
    ${'<'}        | ${'&lt;'}     | ${'<'}
    ${'&'}        | ${'&amp;'}    | ${'&'}
    ${'\u2014'}   | ${'&mdash;'}  | ${'\u2014'}
    ${' '}        | ${'&#x20;'}   | ${' '}
    ${'\u{1F600}'} | ${'&#x1F600;'} | ${'\u{1F600}'}
    ${'nbsp'}     | ${'&nbsp;'}   | ${'\u00A0'}
    ${'LT'}       | ${'&LT;'}     | ${'<'}
    ${'&lt;'}     | ${'&lt;'}     | ${'<'}
    ${'&#xA0;'}   | ${'&#xA0;'}   | ${'\u00A0'}
    ${'&#160;'}   | ${'&#160;'}   | ${'\u00A0'}
  `('$value gives $expected', ({ value, expected, character }: EntityRow) => {
    const entity = htmlEntity(value);
    assert.equal(entity.toString(), expected);
    assert.equal(entity.character, character);
  });

  test('a character with several names gets the shortest, and the lowercase one between spellings', () => {
    // '>' is named `GT` and `gt`.
    assert.equal(htmlEntity('>').toString(), '&gt;');
    // '\u2194' is named `harr`, `leftrightarrow` and `LeftRightArrow`.
    assert.equal(htmlEntity('\u2194').toString(), '&harr;');
  });

  test('an unknown name throws', () => {
    assert.throws(() => htmlEntity('nope'), new Error('unknown HTML entity name: "nope"'));
    assert.throws(() => htmlEntity('&nope;'), new Error('unknown HTML entity name: "nope"'));
  });

  testEach`
    entity    | expected
    ${nbsp}   | ${'&nbsp;'}
    ${ensp}   | ${'&ensp;'}
    ${emsp}   | ${'&emsp;'}
    ${thinsp} | ${'&thinsp;'}
    ${shy}    | ${'&shy;'}
    ${mdash}  | ${'&mdash;'}
    ${ndash}  | ${'&ndash;'}
    ${hellip} | ${'&hellip;'}
    ${copy}   | ${'&copy;'}
  `('the constant for $expected', ({ entity, expected }: { entity: MDHtmlEntity; expected: string }) => {
    assert.equal(entity.toString(), expected);
  });
});

describe('htmlEntity in content', () => {
  testEach`
    content                                                  | expected
    ${paragraph('10', nbsp, 'km')}                           | ${'10&nbsp;km'}
    ${strong(nbsp)}                                          | ${'**&nbsp;**'}
    ${link(['see', nbsp], 'https://example.com')}            | ${'[see&nbsp;](https://example.com)'}
    ${heading(2, ['a', mdash, 'b'])}                         | ${'## a&mdash;b'}
    ${table(['a'], [[['x', nbsp, 'y']]])}                    | ${'| a        |\n| -------- |\n| x&nbsp;y |'}
    ${document(paragraph('a\n', nbsp, 'b'))}                 | ${'a\n&nbsp;b\n'}
  `('$expected', ({ content, expected }: { content: MDElement; expected: string }) => {
    assert.equal(content.toString(), expected);
  });

  test('a summary with an entity is Markdown, set apart by blank lines', () => {
    assert.equal(
      details(['a', nbsp, 'b'], 'c').toString(),
      '<details>\n<summary>\n\na&nbsp;b\n\n</summary>\n\nc\n\n</details>',
    );
  });

  test('an HTML table cell with an entity is Markdown, set apart by blank lines', () => {
    assert.match(htmlTable([], [[['x', nbsp, 'y']]]).toString(), /<td>\n\nx&nbsp;y\n\n<\/td>/);
  });
});

describe('htmlEntity as a placeholder value', () => {
  testEach`
    source                         | expected
    ${'a{@ x @}b'}                 | ${'a&nbsp;b'}
    ${'<b>{@ x @}</b>'}            | ${'<b>&nbsp;</b>'}
    ${'`a{@ x @}b`'}               | ${'`a\u00A0b`'}
  `('$source', ({ source, expected }: { source: string; expected: string }) => {
    assert.equal(template(source, { x: nbsp }).toString(), expected);
  });

  test('in frontmatter, it is the character', () => {
    assert.equal(
      templateDocument('---\nx: a{@ x @}b\n---\n\nhi', { x: nbsp }).toString(),
      '---\nx: a\u00A0b\n---\n\nhi\n',
    );
  });

  test('substitution keeps an entity as it is', () => {
    assert.equal(substitutePlaceholders(nbsp, { x: 'y' }), nbsp);
    assert.equal(substitutePlaceholders(paragraph(nbsp, '{@ x @}'), { x: 'y' }).toString(), '&nbsp;y');
  });
});
