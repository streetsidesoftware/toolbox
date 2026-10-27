import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { hasPlaceholders, isValidPlaceholderName, listPlaceholders, replacePlaceholders } from './index.ts';
import type { PlaceholderOptions } from './index.ts';

interface ReplaceRow {
  text: string;
  values: object;
  expected: string;
}

describe('replacePlaceholders', () => {
  testEach`
    text                             | values                                | expected
    ${'v{@ version @}'}              | ${{ version: '1.2.3' }}               | ${'v1.2.3'}
    ${'v{@version@}'}                | ${{ version: '1.2.3' }}               | ${'v1.2.3'}
    ${'v{@  version\t@}'}            | ${{ version: '1.2.3' }}               | ${'v1.2.3'}
    ${'{@ a @}-{@ b @}-{@ a @}'}     | ${{ a: '1', b: '2' }}                 | ${'1-2-1'}
    ${'{@ pkg.version @}'}           | ${{ pkg: { version: '9.9.9' } }}      | ${'9.9.9'}
    ${'{@ a.b.c @}'}                 | ${{ a: { b: { c: 'deep' } } }}        | ${'deep'}
    ${'(c) {@ year @}'}              | ${{ year: 2030 }}                     | ${'(c) 2030'}
    ${'{@ empty @}!'}                | ${{ empty: '' }}                      | ${'!'}
    ${'no placeholder here'}         | ${{}}                                 | ${'no placeholder here'}
    ${'{@ missing @}'}               | ${{}}                                 | ${'{@ missing @}'}
    ${'{@ a.missing @}'}             | ${{ a: {} }}                          | ${'{@ a.missing @}'}
    ${'{@ a.b @}'}                   | ${{ a: 'text' }}                      | ${'{@ a.b @}'}
    ${'{@ a @}'}                     | ${{ a: { b: '1' } }}                  | ${'{@ a @}'}
    ${'{@ a @}'}                     | ${{ a: true }}                        | ${'{@ a @}'}
    ${'{@ a @}'}                     | ${{ a: null }}                        | ${'{@ a @}'}
    ${'{@ a.length @}'}              | ${{ a: 'text' }}                      | ${'{@ a.length @}'}
    ${'{@ toString @}'}              | ${{}}                                 | ${'{@ toString @}'}
    ${'{@ __proto__.x @}'}           | ${{ ['__proto__']: { x: 'own' } }}    | ${'own'}
    ${'{@ __proto__.x @}'}           | ${JSON.parse('{"__proto__":{"x":"own"}}')} | ${'own'}
    ${'{@ __proto__.constructor @}'} | ${{}}                                 | ${'{@ __proto__.constructor @}'}
    ${'{@ a.prototype @}'}           | ${{ a: class {} }}                    | ${'{@ a.prototype @}'}
    ${'{@ constructor.name @}'}      | ${{}}                                 | ${'{@ constructor.name @}'}
    ${'{@ v @}'}                     | ${{ v: '{@ v @}' }}                   | ${'{@ v @}'}
    ${'{@ v @}'}                     | ${{ v: '$& $1' }}                     | ${'$& $1'}
  `('replacePlaceholders($text, $values)', ({ text, values, expected }: ReplaceRow) => {
    assert.equal(replacePlaceholders(text, values), expected);
  });

  test('takes a resolver', () => {
    const names: string[] = [];
    const result = replacePlaceholders('{@ a @} {@ b.c @} {@ d @}', (name) => {
      names.push(name);
      return name === 'd' ? undefined : name.toUpperCase();
    });
    assert.equal(result, 'A B.C {@ d @}');
    assert.deepEqual(names, ['a', 'b.c', 'd']);
  });

  test('does not replace inside a value', () => {
    assert.equal(replacePlaceholders('{@ a @}{@ b @}', { a: '{@ b', b: ' @}' }), '{@ b @}');
  });
});

describe('multi-line values', () => {
  testEach`
    text                          | value                        | expected
    ${'  {@ v @}'}                | ${'a\nb'}                    | ${'  a\n  b'}
    ${'\t{@ v @}'}                | ${'a\nb'}                    | ${'\ta\n\tb'}
    ${'{@ v @}'}                  | ${'a\nb'}                    | ${'a\nb'}
    ${'x:\n  {@ v @}\ny'}         | ${'a\nb'}                    | ${'x:\n  a\n  b\ny'}
    ${'  - {@ v @}'}              | ${'a\n- b'}                  | ${'  - a\n  - b'}
    ${'  - {@ v @}'}              | ${'a\n  b'}                  | ${'  - a\n    b'}
    ${'  {@ v @} {@ v @}'}        | ${'a\nb'}                    | ${'  a\n  b a\n  b'}
    ${'  {@ v @}'}                | ${'a\n\nb'}                  | ${'  a\n\n  b'}
    ${'  {@ v @}'}                | ${'a\n   \nb'}               | ${'  a\n     \n  b'}
    ${'  {@ v @}\nnext'}          | ${'a\nb\n'}                  | ${'  a\n  b\n\nnext'}
    ${'  {@ v @}'}                | ${'a\r\nb'}                  | ${'  a\r\n  b'}
    ${'  {@ v @}'}                | ${'a\r\n\r\nb'}              | ${'  a\r\n\r\n  b'}
  `('$text with $value', ({ text, value, expected }: { text: string; value: string; expected: string }) => {
    assert.equal(replacePlaceholders(text, { v: value }), expected);
  });

  test('takes the indent from the template, not from earlier values', () => {
    assert.equal(replacePlaceholders('{@ pad @}{@ v @}', { pad: '    ', v: 'a\nb' }), '    a\nb');
  });

  test('indents a value from a resolver', () => {
    assert.equal(
      replacePlaceholders('  {@ v @}', () => 'a\nb'),
      '  a\n  b',
    );
  });

  test('autoIndent: false inserts the value as given', () => {
    assert.equal(replacePlaceholders('  {@ v @}', { v: 'a\nb' }, { autoIndent: false }), '  a\nb');
  });
});

describe('delimiters', () => {
  interface DelimiterRow {
    text: string;
    options: PlaceholderOptions;
    expected: string;
  }

  testEach`
    text                     | options                            | expected
    ${'{{ name }}'}          | ${{ open: '{{', close: '}}' }}     | ${'X'}
    ${'__name__'}            | ${{ open: '__', close: '__' }}     | ${'X'}
    ${'__name__b__'}         | ${{ open: '__', close: '__' }}     | ${'Xb__'}
    ${'__name___'}           | ${{ open: '__', close: '__' }}     | ${'X_'}
    ${'__name__ __name__'}   | ${{ open: '__', close: '__' }}     | ${'X X'}
    ${'/* name */'}          | ${{ open: '/*', close: '*/' }}     | ${'X'}
    ${'$(name)'}             | ${{ open: '$(', close: ')' }}      | ${'X'}
    ${'[.name.]'}            | ${{ open: '[.', close: '.]' }}     | ${'X'}
    ${'<% name %>'}          | ${{ open: '<%' }}                  | ${'<% name %>'}
    ${'<% name @}'}          | ${{ open: '<%' }}                  | ${'X'}
    ${'{@ name @}'}          | ${{ open: '{{', close: '}}' }}     | ${'{@ name @}'}
    ${'a.b'}                 | ${{ open: 'a', close: 'b' }}       | ${'a.b'}
  `('$text with $options', ({ text, options, expected }: DelimiterRow) => {
    assert.equal(replacePlaceholders(text, { name: 'X' }, options), expected);
  });

  test('rejects an empty delimiter', () => {
    assert.throws(() => replacePlaceholders('', {}, { open: '' }), TypeError);
    assert.throws(() => hasPlaceholders('', { close: '' }), TypeError);
  });
});

describe('listPlaceholders', () => {
  test('lists each placeholder with its offsets, in order', () => {
    const text = 'a {@ x @} b {@y.z@} c {@ x @}';
    const found = [...listPlaceholders(text)];
    assert.deepEqual(found, [
      { name: 'x', start: 2, end: 9 },
      { name: 'y.z', start: 12, end: 19 },
      { name: 'x', start: 22, end: 29 },
    ]);
    for (const { start, end } of found) assert.match(text.slice(start, end), /^\{@.*@\}$/);
  });

  test('uses the given delimiters', () => {
    assert.deepEqual(
      [...listPlaceholders('{@ a @} {{ b }}', { open: '{{', close: '}}' })],
      [{ name: 'b', start: 8, end: 15 }],
    );
  });

  test('ends a name at the first close delimiter', () => {
    const options = { open: '__', close: '__' };
    assert.deepEqual([...listPlaceholders('__a__b__', options)], [{ name: 'a', start: 0, end: 5 }]);
    assert.deepEqual([...listPlaceholders('__a_b.c-d__', options)], [{ name: 'a_b.c-d', start: 0, end: 11 }]);
  });

  test('is empty without placeholders', () => {
    assert.deepEqual([...listPlaceholders('plain {@ -bad @} text')], []);
  });

  test('finds placeholders as they are iterated', () => {
    const [first] = listPlaceholders('{@ a @} {@ b @}');
    assert.deepEqual(first, { name: 'a', start: 0, end: 7 });
  });

  test('checks the delimiters when called, not when iterated', () => {
    assert.throws(() => listPlaceholders('', { open: '' }), TypeError);
  });
});

describe('hasPlaceholders', () => {
  testEach`
    text                 | expected
    ${'{@ a @}'}         | ${true}
    ${'x {@a.b@} y'}     | ${true}
    ${'plain'}           | ${false}
    ${'{@ @}'}           | ${false}
    ${'{@ a b @}'}       | ${false}
  `('hasPlaceholders($text)', ({ text, expected }: { text: string; expected: boolean }) => {
    assert.equal(hasPlaceholders(text), expected);
  });

  test('gives the same answer when called again', () => {
    assert.equal(hasPlaceholders('{@ a @}'), true);
    assert.equal(hasPlaceholders('{@ a @}'), true);
  });

  test('a match does not affect the next call', () => {
    assert.equal(hasPlaceholders('x {@ a @}'), true);
    assert.equal(hasPlaceholders('{@ a @}'), true);
  });
});

describe('reusing the regex', () => {
  test('listPlaceholders after hasPlaceholders finds every placeholder', () => {
    assert.equal(hasPlaceholders('x {@ a @}'), true);
    assert.deepEqual(
      [...listPlaceholders('{@ a @} {@ b @}')].map(({ name }) => name),
      ['a', 'b'],
    );
  });

  test('hasPlaceholders between listing and iterating does not change what is found', () => {
    const found = listPlaceholders('{@ a @} {@ b @}');
    assert.equal(hasPlaceholders('{@ c @} and more text'), true);
    assert.deepEqual(
      [...found].map(({ name }) => name),
      ['a', 'b'],
    );
  });

  test('alternating delimiter pairs', () => {
    const curly = { open: '{{', close: '}}' };
    for (let i = 0; i < 2; ++i) {
      assert.equal(replacePlaceholders('{@ a @} {{ a }}', { a: 'X' }), 'X {{ a }}');
      assert.equal(replacePlaceholders('{@ a @} {{ a }}', { a: 'X' }, curly), '{@ a @} X');
    }
  });

  test('a resolver that calls back in with other delimiters', () => {
    const curly = { open: '{{', close: '}}' };
    const result = replacePlaceholders('{@ a @} {@ b @} {@ a @}', (name) =>
      replacePlaceholders(`{{ ${name} }}`, (inner) => inner.toUpperCase(), curly),
    );
    assert.equal(result, 'A B A');
    assert.equal(replacePlaceholders('{@ a @}', { a: 'X' }), 'X');
  });
});

describe('name grammar', () => {
  testEach`
    name           | expected
    ${'a'}         | ${true}
    ${'a-b'}       | ${true}
    ${'_a.b_2.c'}  | ${true}
    ${'2fast'}     | ${true}
    ${'-a'}        | ${false}
    ${'a.-b'}      | ${false}
    ${'a..b'}      | ${false}
    ${'a.'}        | ${false}
    ${'.a'}        | ${false}
    ${'a b'}       | ${false}
    ${''}          | ${false}
  `('isValidPlaceholderName($name)', ({ name, expected }: { name: string; expected: boolean }) => {
    assert.equal(isValidPlaceholderName(name), expected);
    assert.equal(hasPlaceholders(`{@ ${name} @}`), expected);
  });
});
