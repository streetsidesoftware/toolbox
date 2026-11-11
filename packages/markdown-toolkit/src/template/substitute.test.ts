import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockPlaceholder,
  codeBlock,
  document,
  heading,
  inlineCode,
  link,
  list,
  paragraph,
  parse,
  parseDocument,
  placeholder,
  substitutePlaceholders,
  template,
  text,
} from '../index.ts';
import type { AnyContent, MDFragment, MDInline, MDInlineFragment, MDText, TemplateReplacement } from '../index.ts';

describe('substitutePlaceholders', () => {
  test('a placeholder with no replacement is kept, so content can be built in steps', () => {
    const md = paragraph(placeholder('a'), ' and ', placeholder('_b_'));
    const step = substitutePlaceholders(md, { a: '*x*' });
    assert.equal(step.toString(), '\\*x\\* and {@ _b_ @}');
    assert.equal(substitutePlaceholders(step, { _b_: 'y' }).toString(), '\\*x\\* and y');
  });

  test('anything but a string or an element throws', () => {
    assert.throws(
      () => substitutePlaceholders(42 as never, {}),
      new TypeError('expected a string or a Markdown element'),
    );
  });

  test('a string is text', () => {
    const result: MDText | MDInlineFragment | MDFragment = substitutePlaceholders('Version: {@ v @}', { v: '1.2.3' });
    assert.equal(result.toString(), 'Version: 1.2.3');
    assert.equal(substitutePlaceholders('*a* {@ x @}', { x: 'b' }).toString(), '\\*a\\* b');
    assert.equal(substitutePlaceholders('Fruit:\n{@ x @}', { x: list(['a']) }).toString(), 'Fruit:\n\n- a');
  });

  test('inline content can come back as a fragment', () => {
    const inline = placeholder('x') as MDInline;
    const result = substitutePlaceholders(inline, { x: list(['a']) });
    const typedAsPossibleFragment: 'fragment' extends typeof result.type ? true : false = true;
    assert.ok(typedAsPossibleFragment);
    assert.equal(result.type, 'fragment');
  });

  test('the value given is not changed', () => {
    const md = paragraph(placeholder('a'));
    substitutePlaceholders(md, { a: 'x' });
    assert.equal(md.toString(), '{@ a @}');
  });

  test('a document stays a document, in its style', () => {
    const md = document(list(['{@ a @}'])).withStyle({ bullet: '*' });
    const result = substitutePlaceholders(md, { a: link('x', 'u') });
    assert.equal(result.toString(), '* [x](u)\n');
    assert.equal(result.withStyle({ bullet: '+' }).toString(), '+ [x](u)\n');
  });

  test('a fragment keeps the style of its text', () => {
    const md = parse('* a\n* {@ b @}\n');
    assert.equal(substitutePlaceholders(md, { b: 'B' }).toString(), '* a\n* B');
  });

  test('a placeholder that is a whole line takes blocks, and its paragraph splits', () => {
    const fruit = list(['apple', 'orange']);
    const expected = 'Fruit:\n\n- apple\n- orange\n\nMore';
    assert.equal(substitutePlaceholders(parse('Fruit:\n{@ fruit @}\nMore\n'), { fruit }).toString(), expected);
    assert.equal(substitutePlaceholders(parse('Fruit:\n\n{@ fruit @}\n\nMore\n'), { fruit }).toString(), expected);
    assert.equal(template('Fruit:\n{@ fruit @}\nMore\n', { fruit }).toString(), expected);
  });

  test('with an inline replacement, a whole-line placeholder stays in its line', () => {
    const md = substitutePlaceholders(parse('Fruit:\n{@ fruit @}\n'), { fruit: 'apple' });
    assert.equal(md.kind, 'inline');
    assert.equal(md.toString(), 'Fruit:\napple');
  });

  test('a replacement that is only a placeholder becomes the blocks', () => {
    const items = list(['a']);
    assert.equal(substitutePlaceholders(parse('{@ items @}'), { items }).kind, 'block');
    assert.equal(substitutePlaceholders(text('{@ items @}'), { items }).toString(), '- a');
  });

  test('a paragraph that takes blocks becomes a fragment', () => {
    const fragment = parse('Fruit:\n{@ fruit @}');
    if (fragment.kind !== 'inline') throw new Error('expected inline');
    const md = substitutePlaceholders(paragraph(fragment), { fruit: list(['apple']) });
    assert.equal(md.type, 'fragment');
    assert.equal(md.toString(), 'Fruit:\n\n- apple');
    const kept = substitutePlaceholders(paragraph(placeholder('a')), { a: 'x' });
    assert.equal(kept.type, 'paragraph');
  });

  test('a placeholder inside a line takes only inline replacements', () => {
    const items = list(['a']);
    assert.throws(
      () => substitutePlaceholders(parse('See {@ items @}'), { items }),
      new TypeError('{@ items @} must be inline'),
    );
    assert.throws(
      () => substitutePlaceholders(heading(2, placeholder('x')), { x: items }),
      new TypeError('{@ x @} must be inline'),
    );
  });

  testEach`
    replacement    | label
    ${''}          | ${"''"}
    ${[]}          | ${'[]'}
    ${text('')}    | ${"text('')"}
    ${' \t'}       | ${"' \\t'"}
  `(
    'an empty replacement alone on its line ends the paragraph, as passing it directly does: $label',
    ({ replacement }: { replacement: TemplateReplacement }) => {
      assert.equal(
        substitutePlaceholders(document('a', placeholder('x'), 'b'), { x: replacement }).toString(),
        'a\n\nb\n',
      );
      assert.equal(document('a', replacement as AnyContent, 'b').toString(), 'a\n\nb\n');
      assert.equal(template('a\n{@ x @}\nb', { x: replacement }).toString(), 'a\n\nb');
    },
  );

  testEach`
    replacement | expected
    ${' c '}    | ${'a\nc\nb'}
    ${'c\n'}    | ${'a\nc\\\nb'}
    ${'\nc'}    | ${'a\\\nc\nb'}
  `(
    'a replacement alone on its line gives what passing it directly gives: $expected',
    ({ replacement, expected }: { replacement: string; expected: string }) => {
      assert.equal(document('a', replacement, 'b').toString(), `${expected}\n`);
      assert.equal(
        substitutePlaceholders(document('a', placeholder('x'), 'b'), { x: replacement }).toString(),
        `${expected}\n`,
      );
      assert.equal(template('a\n{@ x @}\nb', { x: replacement }).toString(), expected);
    },
  );

  test('placeholder() follows its position', () => {
    const fruit = list(['apple', 'orange']);
    const url = 'https://x';
    const md = document('Fruit:\n', placeholder('fruit'), '\n', link('images', url));
    assert.equal(md.toString(), 'Fruit:\\\n{@ fruit @}\\\n[images](https://x)\n');
    assert.equal(
      substitutePlaceholders(md, { fruit }).toString(),
      'Fruit:\n\n- apple\n- orange\n\n[images](https://x)\n',
    );
    assert.equal(
      substitutePlaceholders(document('Fruit:', placeholder('fruit')), { fruit }).toString(),
      'Fruit:\n\n- apple\n- orange\n',
    );
    assert.throws(
      () => substitutePlaceholders(document(paragraph('Fruit: ', placeholder('fruit'))), { fruit }),
      new TypeError('{@ fruit @} must be inline'),
    );
    assert.equal(substitutePlaceholders(placeholder('fruit'), { fruit }).type, 'fragment');
    const inline = substitutePlaceholders(placeholder('x'), { x: link('a', 'u') });
    assert.equal(inline.type, 'inlineFragment');
    assert.equal(inline.toString(), '[a](u)');
  });

  test('a line ending before a kept placeholder stays a line ending', () => {
    assert.equal(
      parse('Fruit:\n{@ fruit @}\n[images](https://x)').toString(),
      'Fruit:\n{@ fruit @}\n[images](https://x)',
    );
  });

  test('blockPlaceholder() takes blocks or inline replacements', () => {
    const md = document('Fruit:', blockPlaceholder('fruit'));
    assert.equal(md.toString(), 'Fruit:\n\n{@ fruit @}\n');
    assert.equal(substitutePlaceholders(md, { fruit: list(['apple']) }).toString(), 'Fruit:\n\n- apple\n');
    assert.equal(substitutePlaceholders(md, { fruit: 'apple' }).toString(), 'Fruit:\n\napple\n');
    const alone = substitutePlaceholders(blockPlaceholder('fruit'), { fruit: list(['apple']) });
    assert.equal(alone.description, 'a Markdown fragment');
    assert.equal(substitutePlaceholders(blockPlaceholder('fruit'), {}).description, 'a block placeholder');
  });

  test('in code, a placeholder takes a string or text, inserted as is', () => {
    const md = document(codeBlock('npm i {@ pkg @}'), paragraph(inlineCode('{@ pkg @}')));
    assert.equal(substitutePlaceholders(md, { pkg: '*a*' }).toString(), '```\nnpm i *a*\n```\n\n`*a*`\n');
    assert.throws(
      () => substitutePlaceholders(codeBlock('{@ x @}'), { x: link('a', 'u') }),
      new TypeError('{@ x @} is inside code and takes only a string, text, a placeholder or an HTML entity'),
    );
  });

  test('in a URL, a placeholder takes a string, inserted as is', () => {
    const md = paragraph(link('x', placeholder('a').toString()));
    assert.equal(substitutePlaceholders(md, { a: 'a b' }).toString(), '[x](<a b>)');
    assert.equal(substitutePlaceholders(parseDocument('[x]({@a@})'), { a: 'u' }).toString(), '[x](u)\n');
  });

  test('text stays text when every replacement is a string or text', () => {
    const md = substitutePlaceholders(text('v{@ v @} {@ w @}'), { v: '1.0' });
    if (!('text' in md)) throw new Error('expected text');
    assert.equal(md.text, 'v1.0 {@ w @}');
  });

  test('text with another inline replacement becomes an inline fragment', () => {
    const md = substitutePlaceholders(text('Version {@ v @}, *{@ w @}*'), { v: link('1.0', 'u') });
    assert.equal(md.kind, 'inline');
    assert.equal(md.description, 'an inline Markdown fragment');
    assert.equal(md.toString(), 'Version [1.0](u), \\*{@ w @}\\*');
  });

  test('a placeholder is accepted inside code', () => {
    assert.equal(template('`{@ x @}`', { x: placeholder('y') }).toString(), '`{@ y @}`');
  });

  test('names resolve as in template', () => {
    const md = paragraph(placeholder('engines.cspell'));
    assert.equal(substitutePlaceholders(md, { engines: { cspell: '9.x' } }).toString(), '9.x');
  });
});
