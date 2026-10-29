import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockPlaceholder,
  blockTemplate,
  codeBlock,
  document,
  heading,
  inlineCode,
  inlineTemplate,
  link,
  list,
  listItem,
  paragraph,
  parse,
  placeholder,
  substitutePlaceholders,
  template,
  text,
  toBlock,
} from './index.ts';
import type { TemplateValue, TemplateValues } from './index.ts';
import { resolveValue } from './template.ts';

interface ResolveRow {
  values: TemplateValues;
  name: string;
  expected: TemplateValue | undefined;
}

describe('resolveValue', () => {
  const laterNested = { 'a.b': { c: 1, e: 5 }, a: { b: { c: 0, d: 1 } } };
  const laterDotted = { a: { b: { c: 0, d: 1 } }, 'a.b': { c: 1 } };

  testEach`
        values         | name       | expected
        ${laterNested} | ${'a.b.c'} | ${0}
        ${laterNested} | ${'a.b.d'} | ${1}
        ${laterNested} | ${'a.b.e'} | ${5}
        ${laterDotted} | ${'a.b.c'} | ${1}
        ${laterDotted} | ${'a.b.d'} | ${1}
        ${laterDotted} | ${'a.b.e'} | ${undefined}
        ${laterDotted} | ${'a.b'}   | ${undefined}
    `('$name in $values is $expected', ({ values, name, expected }: ResolveRow) => {
    assert.equal(resolveValue(values, name), expected);
  });

  test('a nested key with a dot never matches', () => {
    assert.equal(resolveValue({ a: { 'b.c': 1 } }, 'a.b.c'), undefined);
  });

  test('only own properties count', () => {
    assert.equal(resolveValue({}, 'toString'), undefined);
    assert.equal(resolveValue({ a: {} }, 'a.constructor'), undefined);
  });
});

describe('template kinds', () => {
  test('a single paragraph is inline', () => {
    const md = template('Hello {@ name @}', { name: 'you' });
    assert.equal(md.kind, 'inline');
    // The kind narrows the result to the inline template.
    if (md.kind === 'inline') assert.equal(heading(2, md).toString(), '## Hello you');
  });

  test('a lone placeholder takes its kind from its value', () => {
    assert.equal(template('{@ x @}', { x: 'hi' }).kind, 'inline');
    assert.equal(template('{@ x @}', { x: list(['a']) }).kind, 'block');
  });

  test('anything else is blocks', () => {
    assert.equal(template('- a', {}).kind, 'block');
    assert.equal(template('a\n\nb', {}).kind, 'block');
    assert.equal(template('    code', {}).kind, 'block');
  });

  test('an inline result drops the surrounding whitespace', () => {
    assert.equal(template('\n  Hello  \n', {}).toString(), 'Hello');
  });

  test('blockTemplate keeps a single paragraph as a block', () => {
    const md = blockTemplate('Hello {@ name @}', { name: 'you' });
    assert.equal(md.kind, 'block');
    assert.equal(document(md).toString(), 'Hello you\n');
  });
});

describe('template', () => {
  test('a string is inserted as text and escaped', () => {
    assert.equal(template('Hello {@ name @}!', { name: '*you*' }).toString(), 'Hello \\*you\\*!');
  });

  test('an inline value goes inside a line', () => {
    const md = template('See {@ docs @}.', { docs: link('the docs', 'https://example.com') });
    assert.equal(md.toString(), 'See [the docs](https://example.com).');
  });

  test('a placeholder alone in its paragraph takes blocks', () => {
    const md = template('## Dictionaries\n\n{@ list @}\n\nEnd.\n', { list: list(['en', 'de']) });
    assert.equal(md.toString(), '## Dictionaries\n\n- en\n- de\n\nEnd.');
  });

  test('a block inside a line throws', () => {
    assert.throws(
      () => template('See {@ list @}.', { list: list(['en']) }),
      new TypeError('{@ list @} must be inline, got a list'),
    );
  });

  test('a placeholder inside code is replaced as is', () => {
    const tpl = '```sh\nnpm install -D {@ pkg @}\n```\n\nVersion `{@ engines.cspell @}`\n';
    const md = template(tpl, { pkg: '@cspell/dict-*', 'engines.cspell': '>=8' });
    assert.equal(md.toString(), '```sh\nnpm install -D @cspell/dict-*\n```\n\nVersion `>=8`');
  });

  test('a multi-line value inside code gets the leading whitespace of its line', () => {
    const tpl = '```yaml\nsteps:\n  - run: |\n      {@ script @}\n```\n';
    const md = template(tpl, { script: 'npm ci\n\nnpm test' });
    assert.equal(md.toString(), '```yaml\nsteps:\n  - run: |\n      npm ci\n\n      npm test\n```');
  });

  testEach`
        tpl                       | inside
        ${'<div>{@ x @}</div>'}   | ${'HTML'}
        ${'`{@ x @}`'}            | ${'code'}
        ${'```\n{@ x @}\n```'}    | ${'code'}
    `('a link inside $inside throws: $tpl', ({ tpl, inside }: { tpl: string; inside: string }) => {
    assert.throws(
      () => template(tpl, { x: link('a', 'b') }),
      new TypeError(`{@ x @} is inside ${inside} and takes only a string, text, or a placeholder, got a link`),
    );
  });

  test('code takes text', () => {
    assert.equal(template('`{@ x @}`', { x: text('a*b') }).toString(), '`a*b`');
  });

  testEach`
        values
        ${{ engines: { cspell: placeholder('engines.cspell') } }}
        ${{ 'engines.cspell': placeholder('engines.cspell') }}
        ${{ 'engines.cspell': '{@ engines.cspell @}' }}
    `('a placeholder kept for injection time: $values', ({ values }: { values: TemplateValues }) => {
    const md = template('cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}', values);
    assert.equal(md.toString(), 'cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}');
  });

  test('a placeholder with no value is kept, so templates can be chained', () => {
    const md = template('{@ a @} {@ b.c @}\n\n{@ list @}\n', { a: 'x' });
    assert.equal(md.toString(), 'x {@ b.c @}\n\n{@ list @}');
    assert.equal(blockTemplate('{@ a @}', {}).toString(), '{@ a @}');
    assert.equal(inlineTemplate('a {@ b @} c', {}).toString(), 'a {@ b @} c');
    assert.equal(substitutePlaceholders(md, { b: { c: 'y' }, list: list(['z']) }).toString(), 'x y\n\n- z');
  });

  test('a backslash before a placeholder does not escape it', () => {
    assert.equal(template('`\\{@ x @}`', { x: '1' }).toString(), '`\\1`');
    assert.equal(template('a \\\\{@ x @} b', { x: '1' }).toString(), 'a \\1 b');
  });

  test('the template keeps its own style', () => {
    const md = template('* {@ a @}\n* *b*\n', { a: 'one' });
    assert.equal(md.toString(), '* one\n* *b*');
  });

  test('numbers and booleans are text', () => {
    assert.equal(template('{@ n @} {@ b @}', { n: 1, b: true }).toString(), '1 true');
  });

  test('a newline in a string value is a line break, and one in the template stays soft', () => {
    assert.equal(template('Hello\n{@ name @}!', { name: 'a\nb' }).toString(), 'Hello\na\\\nb!');
  });
});

describe('inlineTemplate', () => {
  test('a fragment inside a list item', () => {
    const e = { name: 'German', url: '../de.md' };
    const md = list([listItem(link(e.name, e.url), inlineTemplate(' - Adds {@ name @} spell checking', e))]);
    assert.equal(md.toString(), '- [German](../de.md) - Adds German spell checking');
  });

  test('block syntax is read as text', () => {
    assert.equal(inlineTemplate('# not a heading', {}).toString(), '\\# not a heading');
  });

  test('more than one paragraph throws', () => {
    assert.throws(() => inlineTemplate('a\n\nb', {}), /inline template text must be one paragraph/);
  });

  test('a block value throws', () => {
    assert.throws(() => inlineTemplate('{@ x @}', { x: codeBlock('x') }), TypeError);
  });

  test('inline values fit', () => {
    assert.equal(inlineTemplate('use {@ x @}', { x: inlineCode('cspell') }).toString(), 'use `cspell`');
  });
});

describe('parse', () => {
  test('a single paragraph is inline', () => {
    const md = parse('  Hello *you*\n');
    if (md.kind !== 'inline') throw new Error('expected inline');
    assert.equal(md.toString(), 'Hello *you*');
    assert.equal(link(md, 'https://example.com').toString(), '[Hello _you_](https://example.com)');
  });

  test('anything else is blocks', () => {
    const md = parse('# Title\n\nSome text.\n');
    if (md.kind !== 'block') throw new Error('expected blocks');
    assert.equal(document(md).toString(), '# Title\n\nSome text.\n');
  });

  test('the text keeps its own style', () => {
    assert.equal(parse('* a\n* b\n').toString(), '* a\n* b');
  });

  test('inside a document, the document style wins', () => {
    assert.equal(document(toBlock(parse('* a\n* b\n'))).toString(), '- a\n- b\n');
  });

  testEach`
        markdown             | expected
        ${'See {@ pkg @}'}   | ${'See {@ pkg @}'}
        ${'{@ _x_ @}'}       | ${'{@ _x_ @}'}
        ${'`{@ x @}`'}       | ${'`{@ x @}`'}
        ${'a \\\\{@ x @} b'} | ${'a \\\\{@ x @} b'}
    `(
    'placeholders are kept as written: $markdown',
    ({ markdown, expected }: { markdown: string; expected: string }) => {
      assert.equal(parse(markdown).toString(), expected);
    },
  );
});

describe('substitutePlaceholders', () => {
  test('a placeholder with no value is kept, so content can be built in steps', () => {
    const md = paragraph(placeholder('a'), ' and ', placeholder('_b_'));
    const step = substitutePlaceholders(md, { a: '*x*' });
    assert.equal(step.toString(), '\\*x\\* and {@ _b_ @}');
    assert.equal(substitutePlaceholders(step, { _b_: 'y' }).toString(), '\\*x\\* and y');
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
    assert.equal(substitutePlaceholders(text('Fruit:\n{@ fruit @}\nMore'), { fruit }).toString(), expected);
  });

  test('with an inline value, a whole-line placeholder stays in its line', () => {
    const md = substitutePlaceholders(parse('Fruit:\n{@ fruit @}\n'), { fruit: 'apple' });
    assert.equal(md.kind, 'inline');
    assert.equal(md.toString(), 'Fruit:\napple');
  });

  test('a value that is only a placeholder becomes the blocks', () => {
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

  test('a placeholder inside a line takes only inline values', () => {
    const items = list(['a']);
    assert.throws(
      () => substitutePlaceholders(parse('See {@ items @}'), { items }),
      new TypeError('{@ items @} must be inline, got a list'),
    );
    assert.throws(
      () => substitutePlaceholders(heading(2, placeholder('x')), { x: items }),
      new TypeError('{@ x @} must be inline, got a list'),
    );
  });

  test('placeholder() follows its position', () => {
    const fruit = list(['apple', 'orange']);
    const url = 'https://x';
    const md = document('Fruit:\n', placeholder('fruit'), '\n', link('images', url));
    assert.equal(md.toString(), 'Fruit:\n{@ fruit @}\n[images](https://x)\n');
    assert.equal(
      substitutePlaceholders(md, { fruit }).toString(),
      'Fruit:\n\n- apple\n- orange\n\n[images](https://x)\n',
    );
    assert.throws(
      () => substitutePlaceholders(document('Fruit: ', placeholder('fruit')), { fruit }),
      new TypeError('{@ fruit @} must be inline, got a list'),
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

  test('blockPlaceholder() takes blocks or inline values', () => {
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
      new TypeError('{@ x @} is inside code and takes only a string, text, or a placeholder, got a link'),
    );
  });

  test('text stays text when every value is a string or text', () => {
    const md = substitutePlaceholders(text('v{@ v @} {@ w @}'), { v: '1.0' });
    if (!('text' in md)) throw new Error('expected text');
    assert.equal(md.text, 'v1.0 {@ w @}');
  });

  test('text with another inline value becomes an inline fragment', () => {
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
