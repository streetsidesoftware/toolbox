import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  codeBlock,
  definitionList,
  details,
  detectStyle,
  document,
  emphasis,
  frontmatter,
  heading,
  lineBreak,
  link,
  list,
  listItem,
  p,
  parse,
  strikethrough,
  strong,
  template,
  text,
  toBlock,
} from '../index.ts';
import type { MDElement } from '../index.ts';

describe('document', () => {
  test('blocks render as a file, ending with one newline', () => {
    const md = document(heading(3, 'Languages'), list(['en', 'de']));
    assert.equal(md.toString(), '### Languages\n\n- en\n- de\n');
  });

  test('arrays of blocks are flattened', () => {
    const sections = [heading(3, 'A'), list(['a'])];
    const md = document(sections, [heading(3, 'B'), [list(['b'])]]);
    assert.equal(md.toString(), '### A\n\n- a\n\n### B\n\n- b\n');
  });

  test('withStyle renders a copy in the given style', () => {
    const md = document(list(['a', emphasis('b'), strong('c')]), codeBlock('x'));
    const styled = md.withStyle({ bullet: '*', emphasis: '*', strong: '_', fence: '~' });
    assert.equal(styled.toString(), '* a\n* *b*\n* __c__\n\n~~~\nx\n~~~\n');
    assert.equal(md.toString(), '- a\n- _b_\n- **c**\n\n```\nx\n```\n');
  });

  test('a field left out keeps the default', () => {
    const md = document(list([emphasis('b')])).withStyle({ bullet: undefined, emphasis: '*' });
    assert.equal(md.toString(), '- *b*\n');
  });

  test('withStyle replaces the earlier style', () => {
    const md = document(list([emphasis('b')]))
      .withStyle({ bullet: '*', emphasis: '*' })
      .withStyle({ bullet: '+' });
    assert.equal(md.toString(), '+ _b_\n');
  });

  test('a template inside renders in the document style', () => {
    const md = document(toBlock(template('* a\n* b\n', {}))).withStyle({ bullet: '+' });
    assert.equal(md.toString(), '+ a\n+ b\n');
  });

  test('detectStyle reads the style an existing file uses', () => {
    const existing = '# Title\n\n* one\n* two\n\nSome *em* and __strong__.\n\n~~~\ncode\n~~~\n';
    const style = detectStyle(existing);
    assert.partialDeepStrictEqual(style, { bullet: '*', emphasis: '*', strong: '_', fence: '~' });
    assert.equal(
      document(list([emphasis('x')]))
        .withStyle(style)
        .toString(),
      '* *x*\n',
    );
  });

  testEach`
    value                                                          | expected
    ${document('a', 'b', 'c')}                                     | ${'a\nb\nc\n'}
    ${document('First.', 'Second.')}                               | ${'First.\nSecond.\n'}
    ${document('See ', link('the docs', 'u'), '.')}                | ${'See\n[the docs](u)\n.\n'}
    ${document(p('See ', link('the docs', 'u'), '.'))}             | ${'See [the docs](u).\n'}
    ${document(['See ', link('the docs', 'u'), '.'])}              | ${'See [the docs](u).\n'}
    ${document('See ', link('the docs', 'u'), '.', list(['a']), 'More')} | ${'See\n[the docs](u)\n.\n\n- a\n\nMore\n'}
    ${document('a', p('p'), 'b')}                                  | ${'a\n\np\n\nb\n'}
    ${document('a', '', 'b')}                                      | ${'a\n\nb\n'}
    ${document('a', [], 'b')}                                      | ${'a\n\nb\n'}
    ${document('a', text(''), 'b')}                                | ${'a\n\nb\n'}
    ${document('a', parse(''), 'b')}                               | ${'a\n\nb\n'}
    ${document('a', strong(''), 'b')}                              | ${'a\n**&#x20;**\nb\n'}
    ${document('a ', ' b')}                                        | ${'a\nb\n'}
    ${document('a\t', '\tb')}                                      | ${'a\nb\n'}
    ${document(strikethrough(' a '), strong('b '))}                | ${'~~a~~\n**b**\n'}
    ${document(['a ', p('p'), ' b'])}                              | ${'a\n\np\n\nb\n'}
    ${list([['a ', list(['x'])]])}                                   | ${'- a\n  - x'}
    ${document('a', '- b')}                                        | ${'a\n\\- b\n'}
    ${document(frontmatter('x: 1'), 'a', 'b')}                     | ${'---\nx: 1\n---\n\na\nb\n'}
    ${list([listItem('a', 'b')])}                                  | ${'- a\n  b'}
    ${list([listItem(['a', 'b'])])}                                | ${'- ab'}
    ${list([listItem(p('a', 'b'))])}                               | ${'- ab'}
    ${list([['a', 'b']])}                                          | ${'- ab'}
    ${details('More', 'First.', 'Second.')}                        | ${'<details>\n<summary>More</summary>\n\nFirst.\nSecond.\n\n</details>'}
  `('each argument goes on its own line: $expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  testEach`
    value                                     | expected
    ${document('a\n', 'b')}                   | ${'a\\\nb\n'}
    ${document('a', '\nb')}                   | ${'a\\\nb\n'}
    ${document('a', '\n', 'b')}               | ${'a\\\nb\n'}
    ${document('a', lineBreak(), 'b')}        | ${'a\\\nb\n'}
  `(
    'a line break between arguments ends the line, with no second line ending: $expected',
    ({ value, expected }: { value: MDElement; expected: string }) => {
      assert.equal(value.toString(), expected);
    },
  );

  test('a blank line in a string is two line breaks, not a new paragraph', () => {
    assert.equal(document('a\n\nb').toString(), 'a\\\n\\\nb\n');
  });

  testEach`
    value                                                         | expected
    ${document(listItem('Dutch'))}                                | ${'- Dutch\n'}
    ${document(listItem('Dutch'), listItem('French'))}            | ${'- Dutch\n- French\n'}
    ${document([listItem('Dutch'), listItem('French')])}          | ${'- Dutch\n- French\n'}
    ${document(listItem('Dutch'), 'French')}                      | ${'- Dutch\n\nFrench\n'}
    ${document(['Langs:', listItem('en')])}                       | ${'Langs:\n\n- en\n'}
    ${document(list(['Dutch']), listItem('French'))}              | ${'- Dutch\n- French\n'}
    ${document(listItem('Dutch'), list(['French']))}              | ${'- Dutch\n- French\n'}
    ${document(list(['a']), listItem('b'), list(['c']))}          | ${'- a\n- b\n- c\n'}
    ${document(list(['a']), list(['b']))}                         | ${'- a\n\n* b\n'}
    ${document(template('- a', {}), listItem('b'))}               | ${'- a\n- b\n'}
    ${document(template('1. a', {}), listItem('b'))}              | ${'1. a\n1. b\n'}
    ${document(listItem('a'), template('1. b', {}))}              | ${'1. a\n1. b\n'}
    ${document(listItem('a'), template('3. b', {}))}              | ${'3. a\n3. b\n'}
    ${document(template('- [ ] a', {}), listItem('b'))}           | ${'- [ ] a\n- b\n'}
    ${document(listItem('a'), template('Text\n\n- b', {}))}     | ${'- a\n\nText\n\n- b\n'}
    ${listItem('Langs', listItem('en'), listItem('nl'))}          | ${'- Langs\n  - en\n  - nl'}
    ${list([['Langs', listItem('en')]])}                          | ${'- Langs\n  - en'}
    ${toBlock(listItem('Dutch'))}                                 | ${'- Dutch'}
    ${toBlock(['Langs:', listItem('en')])}                        | ${'Langs:\n\n- en'}
    ${details('Langs', listItem('Dutch'))}                        | ${'<details>\n<summary>Langs</summary>\n\n- Dutch\n\n</details>'}
    ${definitionList([['Langs', [listItem('en'), listItem('nl')]]])} | ${'<dl>\n\n<dt>Langs</dt>\n<dd>\n\n- en\n- nl\n\n</dd>\n\n</dl>'}
  `('list items outside a list form one: $expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('a list item joins a list without changing it', () => {
    const langs = list(['Dutch']);
    assert.equal(document(langs, listItem('French')).toString(), '- Dutch\n- French\n');
    assert.equal(langs.toString(), '- Dutch');
  });
});
