import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  emphasis,
  heading,
  inlineCode,
  link,
  list,
  listItem,
  paragraph,
  placeholder,
  strikethrough,
  strong,
  sub,
  substitutePlaceholders,
  sup,
  table,
  template,
} from '../index.ts';
import type { MDElement, MDInline } from '../index.ts';
import { readBack } from './readBack.testHelper.ts';

describe('strong, emphasis, strikethrough', () => {
  testEach`
        value                                             | expected
        ${strong('pre-release')}                          | ${'**pre-release**'}
        ${emphasis('note')}                               | ${'_note_'}
        ${strikethrough(inlineCode('cSpell.oldSetting'))} | ${'~~`cSpell.oldSetting`~~'}
        ${strong(['When: ', emphasis('always')])}         | ${'**When: _always_**'}
    `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  testEach`
        value                         | expected
        ${strong('')}                 | ${'**&#x20;**'}
        ${emphasis([])}               | ${'_&#x20;_'}
        ${strikethrough('')}          | ${'~~&#x20;~~'}
        ${strong(emphasis(''))}       | ${'**_&#x20;_**'}
    `('empty formatting shows as a space: $expected', ({ value, expected }: { value: MDInline; expected: string }) => {
    assert.equal(paragraph(value).toString(), expected);
  });

  test('empty formatting keeps the text around it apart', () => {
    assert.equal(paragraph('a', strong(''), 'b').toString(), '&#x61;**&#x20;**&#x62;');
  });

  test('whitespace stays as given', () => {
    assert.equal(paragraph('a', strong('  '), 'b').toString(), '&#x61;**&#x20;&#x20;**&#x62;');
  });

  test('formatting left empty by substitution shows as a space', () => {
    const md = paragraph('a', strong(placeholder('x')), 'b');
    assert.equal(substitutePlaceholders(md, { x: '' }).toString(), '&#x61;**&#x20;**&#x62;');
  });

  test('in a list item', () => {
    const md = list([listItem([link('Danish', '../da.md'), ' ', strong('pre-release'), ' - Adds Danish'])]);
    assert.equal(md.toString(), '- [Danish](../da.md) **pre-release** - Adds Danish');
  });

  test('block content throws', () => {
    // @ts-expect-error a list is not inline
    assert.throws(() => strong(list(['a'])), new TypeError('strong content must be inline'));
  });
});

describe('sup, sub', () => {
  testEach`
        value                                          | expected
        ${sup('2')}                                    | ${'<sup>2</sup>'}
        ${sub('2')}                                    | ${'<sub>2</sub>'}
        ${sup(emphasis('req'))}                        | ${'<sup>_req_</sup>'}
        ${sub(sup(emphasis('< required >')))}          | ${'<sub><sup>_< required >_</sup></sub>'}
        ${sup([' ', emphasis('req'), ' '])}            | ${'<sup> _req_ </sup>'}
        ${sup('<b> *c*')}                              | ${'<sup>\\<b> \\*c\\*</sup>'}
        ${sup('')}                                     | ${'<sup></sup>'}
        ${sup(link('1', 'https://cspell.org'))}        | ${'<sup>[1](https://cspell.org)</sup>'}
    `('$expected', ({ value, expected }: { value: MDInline; expected: string }) => {
    assert.equal(paragraph(value).toString(), expected);
  });

  test('the content reads back as Markdown between the tags', () => {
    const md = paragraph('name ', sub(sup(emphasis('< required >'))));
    assert.deepEqual(readBack(md.toString()), [
      'text:name ',
      'html:<sub>',
      'html:<sup>',
      'emphasis:< required >',
      'html:</sup>',
      'html:</sub>',
    ]);
  });

  test('text that looks like a tag reads back as text', () => {
    assert.deepEqual(readBack(paragraph(sup('<b>')).toString()), ['html:<sup>', 'text:<b>', 'html:</sup>']);
  });

  test('a line break inside stays inside', () => {
    const md = paragraph(sup('a\nb'));
    assert.equal(md.toString(), '<sup>a\\\nb</sup>');
    assert.deepEqual(readBack(md.toString()), ['html:<sup>', 'text:a', 'break:', 'text:b', 'html:</sup>']);
  });

  test('in a table cell', () => {
    const md = table(['Name'], [[['name ', sup(emphasis('req'))]]]);
    assert.equal(md.toString(), '| Name                  |\n| --------------------- |\n| name <sup>_req_</sup> |');
  });

  test('in a heading', () => {
    assert.equal(heading(2, ['x', sup('2')]).toString(), '## x<sup>2</sup>');
  });

  test('a placeholder inside is substituted', () => {
    const md = paragraph('name ', sup(placeholder('marker')));
    assert.equal(md.toString(), 'name <sup>{@ marker @}</sup>');
    assert.equal(substitutePlaceholders(md, { marker: emphasis('req') }).toString(), 'name <sup>_req_</sup>');
  });

  test('a replacement', () => {
    assert.equal(template('name {@x@}', { x: sup(emphasis('req')) }).toString(), 'name <sup>_req_</sup>');
  });

  test('a backslash at the end stays text', () => {
    const md = paragraph(sup('C:\\'));
    assert.equal(md.toString(), '<sup>C:\\\\</sup>');
    assert.deepEqual(readBack(md.toString()), ['html:<sup>', 'text:C:\\', 'html:</sup>']);
  });

  testEach`
        build  | name
        ${sup} | ${'superscript'}
        ${sub} | ${'subscript'}
    `('$name: a block is refused', ({ build, name }: { build: typeof sup; name: string }) => {
    assert.throws(() => build(paragraph('a') as unknown as MDInline), {
      name: 'TypeError',
      message: `${name} content must be inline`,
    });
  });
});
