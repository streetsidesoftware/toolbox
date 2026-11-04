import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockTemplate,
  codeBlock,
  copy,
  details,
  dl,
  document,
  emsp,
  ensp,
  heading,
  hellip,
  htmlEntity,
  htmlTable,
  inlineTemplate,
  link,
  mdash,
  nbsp,
  ndash,
  paragraph,
  parse,
  parseDocument,
  shy,
  strong,
  substitutePlaceholders,
  table,
  template,
  templateDocument,
  thinsp,
} from '../index.ts';
import type { MDElement, MDHtmlEntity, MDInlineFragment } from '../index.ts';

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
    ${'&#X41;'}   | ${'&#X41;'}   | ${'A'}
    ${'<\u20D2'}  | ${'&nvlt;'}   | ${'<\u20D2'}
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

  testEach`
    character   | expected
    ${'\u00C5'} | ${'&Aring;'}
    ${'\u00A8'} | ${'&uml;'}
    ${'\u2254'} | ${'&Assign;'}
    ${'\u2250'} | ${'&doteq;'}
    ${'\u226B'} | ${'&gg;'}
    ${'\u02C7'} | ${'&caron;'}
    ${'\u226A'} | ${'&ll;'}
    ${'\u03C2'} | ${'&sigmaf;'}
  `(
    'a tie between names of one length gives $expected',
    ({ character, expected }: { character: string; expected: string }) => {
      assert.equal(htmlEntity(character).toString(), expected);
    },
  );

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
    ${document(paragraph('a\n', nbsp, 'b'))}                 | ${'a\\\n&nbsp;b\n'}
  `('$expected', ({ content, expected }: { content: MDElement; expected: string }) => {
    assert.equal(content.toString(), expected);
  });

  test('a summary with an entity stays on the tag line, as plain text does', () => {
    assert.equal(
      details(['a&', nbsp, 'b'], 'c').toString(),
      '<details>\n<summary>a&amp;&nbsp;b</summary>\n\nc\n\n</details>',
    );
  });

  test('a definition term with an entity stays on the tag line', () => {
    assert.match(dl([[['a', nbsp], 'c']]).toString(), /<dt>a&nbsp;<\/dt>/);
  });

  test('an HTML table cell with an entity stays on the tag line', () => {
    assert.match(htmlTable([], [[['x<', nbsp, 'y']]]).toString(), /<td>x&lt;&nbsp;y<\/td>/);
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

  test('in code, through substitutePlaceholders, inlineTemplate and blockTemplate, it is the character', () => {
    assert.equal(substitutePlaceholders(codeBlock('a{@ x @}b'), { x: nbsp }).toString(), '```\na\u00A0b\n```');
    assert.equal(inlineTemplate('`a{@ x @}b`', { x: nbsp }).toString(), '`a\u00A0b`');
    assert.equal(blockTemplate('```\na{@ x @}b\n```', { x: nbsp }).toString(), '```\na\u00A0b\n```');
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

describe('an entity written in Markdown', () => {
  testEach`
    source                               | expected
    ${'[`A`](#a)&ZeroWidthSpace;`[]`'}   | ${'[`A`](#a)&ZeroWidthSpace;`[]`'}
    ${'a&nbsp;b'}                        | ${'a&nbsp;b'}
    ${'&copy; &amp; &lt;'}               | ${'&copy; &amp; &lt;'}
    ${'a&#8203;b&#x200B;c'}              | ${'a&#8203;b&#x200B;c'}
    ${'&nbsp;a\n&nbsp;b'}               | ${'&nbsp;a\n&nbsp;b'}
    ${'**a&nbsp;b**'}                    | ${'**a&nbsp;b**'}
    ${'[a&nbsp;b](#a)'}                  | ${'[a&nbsp;b](#a)'}
    ${'<b>&nbsp;</b>'}                   | ${'<b>&nbsp;</b>'}
    ${'| a&nbsp;b |\n| - |\n| c |'}    | ${'| a&nbsp;b |\n| -------- |\n| c        |'}
    ${'\\&nbsp;'}                      | ${'\\&nbsp;'}
    ${'`a&nbsp;b`'}                      | ${'`a&nbsp;b`'}
  `('parse keeps $source', ({ source, expected }: { source: string; expected: string }) => {
    assert.equal(parse(source).toString(), expected);
  });

  test('templates and parseDocument keep it', () => {
    assert.equal(template('`a`&ZeroWidthSpace;{@ x @}', { x: '[]' }).toString(), '`a`&ZeroWidthSpace;\\[]');
    assert.equal(inlineTemplate('a&nbsp;{@ x @}', { x: 'b' }).toString(), 'a&nbsp;b');
    assert.equal(blockTemplate('a&nbsp;{@ x @}', { x: 'b' }).toString(), 'a&nbsp;b');
    assert.equal(templateDocument('a&nbsp;{@ x @}', { x: 'b' }).toString(), 'a&nbsp;b\n');
    assert.equal(parseDocument('a&nbsp;b').toString(), 'a&nbsp;b\n');
  });

  test('a parsed table cell keeps it', () => {
    assert.equal(
      table(['a'], [[parse('x&nbsp;y') as MDInlineFragment]]).toString(),
      '| a        |\n| -------- |\n| x&nbsp;y |',
    );
  });

  test('a URL, a title and an image description hold the character', () => {
    assert.equal(
      parse('[a](https://example.com/?a&amp;b "&copy;")').toString(),
      '[a](https://example.com/?a\\&b "\u00A9")',
    );
    assert.equal(parse('![a&copy;](x.png)').toString(), '![a\u00A9](x.png)');
  });

  testEach`
    source                             | expected
    ${'![a [b&copy;](u)](x.png)'}      | ${'![a b\u00A9](x.png)'}
    ${'[b ![c&copy;](i.png)](u)'}      | ${'[b ![c\u00A9](i.png)](u)'}
    ${'```js&amp;x\ny\n```'}           | ${'```js&x\ny\n```'}
    ${'[^a&amp;]\n\n[^a&amp;]: n'}      | ${'[^a&]\n\n[^a&]: n'}
  `(
    'a string holds the character, even nested: $source',
    ({ source, expected }: { source: string; expected: string }) => {
      assert.equal(parse(source).toString(), expected);
    },
  );

  test('an entity is text, so it is not part of a placeholder and does not leave a line empty', () => {
    assert.equal(template('{@&#32;x&#32;@}', { x: 'y' }).toString(), '{@&#32;x&#32;@}');
    assert.equal(blockTemplate('a\n&#32;{@ x @}\nb', { x: '' }).toString(), 'a\n&#32;\nb');
  });
});
