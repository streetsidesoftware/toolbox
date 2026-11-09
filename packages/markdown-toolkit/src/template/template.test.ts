import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockTemplate,
  codeBlock,
  document,
  emphasis,
  heading,
  htmlEntity,
  inlineCode,
  inlineTemplate,
  lineBreak,
  link,
  list,
  listItem,
  parse,
  parseDocument,
  placeholder,
  strong,
  substitutePlaceholders,
  template,
  templateDocument,
  text,
} from '../index.ts';
import type { MDInline, TemplateReplacement, TemplateReplacements } from '../index.ts';

describe('template kinds', () => {
  test('a single paragraph is inline', () => {
    const md = template('Hello {@ name @}', { name: 'you' });
    assert.equal(md.kind, 'inline');
    // The kind narrows the result to the inline template.
    if (md.kind === 'inline') assert.equal(heading(2, md).toString(), '## Hello you');
  });

  test('a lone placeholder takes its kind from its replacement', () => {
    assert.equal(template('{@ x @}', { x: 'hi' }).kind, 'inline');
    assert.equal(template('{@ x @}', { x: list(['a']) }).kind, 'block');
  });

  test('an empty result is inline', () => {
    assert.equal(template('', {}).kind, 'inline');
    assert.equal(template('{@ x @}', { x: '' }).kind, 'inline');
    assert.equal(substitutePlaceholders(parse('{@ x @}'), { x: '' }).kind, 'inline');
  });

  test('an empty replacement leaves no paragraph', () => {
    assert.equal(template('a\n\n{@ x @}\n\nb', { x: '' }).toString(), 'a\n\nb');
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

  test('an inline replacement goes inside a line', () => {
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

  test('a multi-line replacement inside code gets the leading whitespace of its line', () => {
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
      new TypeError(
        `{@ x @} is inside ${inside} and takes only a string, text, a placeholder or an HTML entity, got a link`,
      ),
    );
  });

  testEach`
        tpl                                | expected
        ${'[x]({@a@})'}                    | ${'[x](u)'}
        ${'[x](<{@ a @}>)'}                | ${'[x](u)'}
        ${'![i]({@a@})'}                   | ${'![i](u)'}
        ${'[x](u "{@ a @}")'}              | ${'[x](u "u")'}
        ${'![i](u "{@ a @}")'}             | ${'![i](u "u")'}
        ${'[x]({@b@})'}                    | ${'[x]({@b@})'}
        ${'[x][r]\n\n[r]: {@a@} "{@a@}"'} | ${'[x][r]\n\n[r]: u "u"'}
        ${'<https://e.com/{@a@}>'}         | ${'<https://e.com/u>'}
        ${'https://e.com/{@a@}'}           | ${'<https://e.com/u>'}
    `(
    'a placeholder in a URL or title is replaced as is: $tpl',
    ({ tpl, expected }: { tpl: string; expected: string }) => {
      assert.equal(template(tpl, { a: 'u' }).toString(), expected);
    },
  );

  testEach`
        replacement            | expected
        ${'a b'}               | ${'[x](<a b>)'}
        ${'a)b'}               | ${'[x](a\\)b)'}
    `(
    'a replacement in a URL keeps the link whole: $replacement',
    ({ replacement, expected }: { replacement: string; expected: string }) => {
      assert.equal(template('[x]({@a@})', { a: replacement }).toString(), expected);
    },
  );

  testEach`
        tpl                    | replacement             | inside
        ${'[x]({@x@})'}        | ${link('a', 'b')}       | ${'a URL'}
        ${'[x](u "{@x@}")'}    | ${strong('s')}          | ${'a title'}
        ${'[x]({@x@})'}        | ${htmlEntity('&amp;')}  | ${'a URL'}
    `(
    'any other replacement inside $inside throws, an HTML entity too: $tpl',
    ({ tpl, replacement, inside }: { tpl: string; replacement: MDInline; inside: string }) => {
      assert.throws(
        () => template(tpl, { x: replacement }),
        new TypeError(
          `{@ x @} is inside ${inside} and takes only a string, text or a placeholder, got ${replacement.description}`,
        ),
      );
    },
  );

  test('code takes text', () => {
    assert.equal(template('`{@ x @}`', { x: text('a*b') }).toString(), '`a*b`');
  });

  testEach`
        replacements
        ${{ engines: { cspell: placeholder('engines.cspell') } }}
        ${{ 'engines.cspell': placeholder('engines.cspell') }}
        ${{ 'engines.cspell': '{@ engines.cspell @}' }}
    `(
    'a placeholder kept for injection time: $replacements',
    ({ replacements }: { replacements: TemplateReplacements }) => {
      const md = template('cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}', replacements);
      assert.equal(md.toString(), 'cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}');
    },
  );

  test('a placeholder with no replacement is kept, so templates can be chained', () => {
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

  testEach`
    tpl                         | x                                         | expected
    ${'A\n\n{@ x @}'}          | ${listItem('Dutch')}                      | ${'A\n\n- Dutch'}
    ${'A\n\n{@ x @}'}          | ${[listItem('Dutch'), listItem('French')]} | ${'A\n\n- Dutch\n- French'}
    ${'- a\n\n{@ x @}'}        | ${listItem('b')}                          | ${'- a\n- b'}
    ${'{@ x @}\n\n- b'}        | ${listItem('a')}                          | ${'- a\n- b'}
    ${'- a\n\n  {@ x @}'}      | ${listItem('b')}                          | ${'- a\n\n  - b'}
  `(
    'a list item replacement on its own line forms a list: $tpl',
    ({ tpl, x, expected }: { tpl: string; x: TemplateReplacement; expected: string }) => {
      assert.equal(template(tpl, { x }).toString(), expected);
    },
  );

  test('a list item replacement inside a line', () => {
    assert.throws(
      () => template('See {@ x @}', { x: listItem('Dutch') }),
      new TypeError("{@ x @} can't hold a list item; a list item goes in a list"),
    );
  });

  test('numbers and booleans are text', () => {
    assert.equal(template('{@ n @} {@ b @}', { n: 1, b: true }).toString(), '1 true');
  });

  test('an empty replacement leaves no paragraph', () => {
    assert.equal(template('a\n\n{@ x @}\n\nb', { x: '' }).toString(), 'a\n\nb');
  });

  test('an empty replacement in formatting shows as a space', () => {
    assert.equal(template('a **{@ x @}** b', { x: '' }).toString(), 'a&#x20;**&#x20;** b');
  });

  test('an empty replacement in inline code shows as a space', () => {
    assert.equal(template('a `{@ x @}` b', { x: '' }).toString(), 'a ` ` b');
  });

  test('an empty replacement keeps a link with a URL', () => {
    assert.equal(template('a [{@ x @}](https://u) b', { x: '' }).toString(), 'a [](https://u) b');
  });

  testEach`
    tpl                              | label
    ${'a\n{@ x @}{@ y @}\nb'}        | ${'side by side'}
    ${'a\n{@ x @} {@ y @}\nb'}       | ${'with a space between'}
    ${'a\r\n{@ x @}{@ y @}\r\nb'}    | ${'with CRLF line endings'}
  `('empty replacements that leave a line empty between them end the paragraph: $label', ({ tpl }: { tpl: string }) => {
    assert.equal(template(tpl, { x: '', y: '' }).toString(), 'a\n\nb');
    assert.equal(document('a', ['', ''], 'b').toString(), 'a\n\nb\n');
    const md = substitutePlaceholders(document('a', [placeholder('x'), placeholder('y')], 'b'), { x: '', y: '' });
    assert.equal(md.toString(), 'a\n\nb\n');
  });

  test('an empty replacement on the line after a line break ends the paragraph', () => {
    assert.equal(template('a\\\n{@ x @}\nb', { x: '' }).toString(), 'a\n\nb');
    const md = substitutePlaceholders(document(['a', lineBreak()], placeholder('x'), 'b'), { x: '' });
    assert.equal(md.toString(), document(['a', lineBreak()], '', 'b').toString());
    assert.equal(md.toString(), 'a\n\nb\n');
  });

  testEach`
    replacement                      | label
    ${inlineTemplate('c\n', {})}     | ${"'c\\n'"}
    ${inlineTemplate('c \n', {})}    | ${"'c \\n'"}
    ${inlineTemplate('c\n ', {})}    | ${"'c\\n '"}
  `(
    'a replacement with its own line ending, inside a sentence, keeps the paragraph whole and its lines unescaped: $label',
    ({ replacement }: { replacement: TemplateReplacement }) => {
      assert.equal(template('a {@ x @}\nb', { x: replacement }).toString(), 'a c\nb');
    },
  );

  test('in an inline template, an empty line left by an empty replacement goes', () => {
    assert.equal(inlineTemplate('a\n{@ x @}\nb', { x: '' }).toString(), 'a\nb');
    assert.equal(inlineTemplate('a\n{@ x @}{@ y @}\nb', { x: '', y: '' }).toString(), 'a\nb');
  });

  test('an empty replacement in an inline template or a document', () => {
    assert.equal(inlineTemplate('a **{@ x @}** b', { x: '' }).toString(), 'a&#x20;**&#x20;** b');
    assert.equal(templateDocument('a\n\n{@ x @}\n', { x: '' }).toString(), 'a\n');
  });

  test('a formatted replacement from a builder', () => {
    assert.equal(template('Hi {@x@}.', { x: emphasis('a') }).toString(), 'Hi _a_.');
  });
});

describe('a replacement parsed from its own text', () => {
  testEach`
    markdown        | replacement                  | expected        | label
    ${'Hi {@x@}.'}  | ${parse('*a*')}              | ${'Hi _a_.'}    | ${'emphasis from parse'}
    ${'Hi {@x@}.'}  | ${parse('**a**')}            | ${'Hi **a**.'}  | ${'strong from parse'}
    ${'Hi {@x@}.'}  | ${template('*a*', {})}       | ${'Hi _a_.'}    | ${'emphasis from template'}
    ${'{@x@}'}      | ${parse('- a')}              | ${'- a'}        | ${'a list from parse'}
    ${'{@x@}'}      | ${parse('1. a')}             | ${'1. a'}       | ${'an ordered list from parse'}
    ${'{@x@}'}      | ${parse('---')}              | ${'---'}        | ${'a rule from parse'}
    ${'{@x@}'}      | ${parseDocument('*a*\n')}    | ${'_a_'}        | ${'emphasis from parseDocument'}
  `(
    'template and blockTemplate take $label',
    ({ markdown, replacement, expected }: { markdown: string; replacement: TemplateReplacement; expected: string }) => {
      assert.equal(template(markdown, { x: replacement }).toString(), expected);
      assert.equal(blockTemplate(markdown, { x: replacement }).toString(), expected);
    },
  );

  test('the other ways to substitute it', () => {
    assert.equal(templateDocument('Hi {@x@}.', { x: parse('*a*') }).toString(), 'Hi _a_.\n');
    assert.equal(inlineTemplate('Hi {@x@}.', { x: parse('*a*') }).toString(), 'Hi _a_.');
    assert.equal(substitutePlaceholders(parse('Hi {@x@}.'), { x: parse('*a*') }).toString(), 'Hi _a_.');
  });

  test('a replacement with no formatting', () => {
    assert.equal(template('Hi {@x@}.', { x: parse('plain') }).toString(), 'Hi plain.');
  });

  testEach`
    create           | label
    ${template}      | ${'template'}
    ${blockTemplate} | ${'blockTemplate'}
  `('the style of $label comes from its own text', ({ create }: { create: typeof blockTemplate }) => {
    const listsAndText = parse('- a\n\ntext\n\n- b');
    assert.equal(
      create('* one\n\ntext\n\n{@x@}', { x: listsAndText }).toString(),
      '* one\n\ntext\n\n* a\n\ntext\n\n* b',
    );
    assert.equal(create('*t* {@x@}', { x: parse('_a_') }).toString(), '*t* *a*');
    // Two lists in a row need different bullets, or they would join into one.
    assert.equal(create('* one\n\n{@x@}', { x: parse('- a') }).toString(), '* one\n\n- a');
    // The replacement's markers are at the offsets of the `_`s in the template, so they'd outvote its `*` if they counted.
    const replacement = parse('abcdefgh*a* ab*b*');
    assert.equal(
      create('*t* and _ and _ {@x@}', { x: replacement }).toString(),
      '*t* and \\_ and \\_ abcdefgh*a* ab*b*',
    );
  });
});

describe('inlineTemplate', () => {
  test('a fragment inside a list item', () => {
    const e = { name: 'German', url: '../de.md' };
    const md = list([listItem([link(e.name, e.url), inlineTemplate(' - Adds {@ name @} spell checking', e)])]);
    assert.equal(md.toString(), '- [German](../de.md) - Adds German spell checking');
  });

  test('block syntax is read as text', () => {
    assert.equal(inlineTemplate('# not a heading', {}).toString(), '\\# not a heading');
  });

  test('more than one paragraph throws', () => {
    assert.throws(() => inlineTemplate('a\n\nb', {}), /inline template text must be one paragraph/);
  });

  test('a block replacement throws', () => {
    assert.throws(() => inlineTemplate('{@ x @}', { x: codeBlock('x') }), TypeError);
  });

  test('inline replacements fit', () => {
    assert.equal(inlineTemplate('use {@ x @}', { x: inlineCode('cspell') }).toString(), 'use `cspell`');
  });
});
