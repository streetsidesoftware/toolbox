import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import type * as Builders from './index.ts';
import type { MDValue } from './index.ts';
import {
  blockPlaceholder,
  blockText,
  br,
  codeBlock,
  comment,
  detectStyle,
  document,
  emphasis,
  heading,
  horizontalRule,
  hr,
  inlineCode,
  inlineText,
  isMarkdown,
  lineBreak,
  link,
  list,
  listItem,
  paragraph,
  placeholder,
  strikethrough,
  strong,
  template,
  text,
  toBlock,
} from './index.ts';

describe('escaping', () => {
  testEach`
        value                                               | expected
        ${link('a]b[c', '../a.md')}                         | ${'[a\\]b\\[c](../a.md)'}
        ${link(inlineCode('@cspell/dict-en'), '../en')}     | ${'[`@cspell/dict-en`](../en)'}
        ${link('docs', new URL('https://example.com/a b'))} | ${'[docs](https://example.com/a%20b)'}
        ${inlineCode('a`b')}                                | ${'``a`b``'}
        ${text('*not* emphasis')}                           | ${'\\*not\\* emphasis'}
        ${comment('a --> b')}                               | ${'<!-- a -- > b -->'}
        ${comment('cspell:disable')}                        | ${'<!-- cspell:disable -->'}
    `('$expected', ({ value, expected }: { value: MDValue; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('a code block fence is longer than any fence in the code', () => {
    assert.equal(codeBlock('```js\nx\n```', 'md').toString(), '````md\n```js\nx\n```\n````');
  });

  test('block syntax at the start of an item is escaped', () => {
    assert.equal(list(['- not a list', '1. not ordered']).toString(), '- \\- not a list\n- 1\\. not ordered');
  });
});

describe('placeholders', () => {
  test('a placeholder renders as written', () => {
    assert.equal(placeholder('engines.cspell').toString(), '{@ engines.cspell @}');
  });

  test('escaping text leaves placeholder syntax alone', () => {
    assert.equal(text('{@ _a_b.c-d @} and *x*').toString(), '{@ _a_b.c-d @} and \\*x\\*');
  });

  test('a placeholder fits inside inline code as a string', () => {
    assert.equal(inlineCode(`version: ${placeholder('engine.version')}`).toString(), '`version: {@ engine.version @}`');
  });

  test('an invalid name throws', () => {
    assert.throws(() => placeholder('-bad'), /invalid placeholder name/);
  });

  test('a name such as constructor is a name like any other', () => {
    assert.equal(placeholder('a.constructor').toString(), '{@ a.constructor @}');
  });
});

describe('composing', () => {
  test('a list of links', () => {
    const extensions = [
      { name: 'Ancient Greek', url: 'https://example.com/grc', description: 'Adds Ancient Greek' },
      { name: 'Arabic', url: 'https://example.com/ar', description: 'Adds Arabic' },
    ];
    const md = list(extensions.map((e) => paragraph(link(e.name, e.url), ` - ${e.description}`)));
    assert.equal(
      md.toString(),
      '- [Ancient Greek](https://example.com/grc) - Adds Ancient Greek\n- [Arabic](https://example.com/ar) - Adds Arabic',
    );
  });

  test('an array entry is one item, never a nested list', () => {
    const md = list([listItem('Languages'), ['Ref: ', link('German', '../g.md')], 'Other']);
    assert.equal(md.toString(), '- Languages\n- Ref: [German](../g.md)\n- Other');
  });

  test('a nested list is a list inside an item', () => {
    const md = list([listItem('Languages', list(['English', 'German'])), 'Other']);
    assert.equal(md.toString(), '- Languages\n  - English\n  - German\n- Other');
  });

  test('a list item with a code block', () => {
    const md = list([listItem('Install:', codeBlock('npm install -D @cspell/dict-en', 'sh'))]);
    assert.equal(md.toString(), '- Install:\n  ```sh\n  npm install -D @cspell/dict-en\n  ```');
  });

  test('a heading with inline content', () => {
    assert.equal(heading(2, ['Using ', inlineCode('cspell')]).toString(), '## Using `cspell`');
  });

  test('inline pieces are joined as given', () => {
    assert.equal(
      paragraph([inlineCode('x'), 's'], ', ', comment('cspell:ignore xs')).toString(),
      '`x`s, <!-- cspell:ignore xs -->',
    );
  });

  test('a value renders inside a template literal', () => {
    assert.equal(`See ${link('docs', 'https://example.com')}.`, 'See [docs](https://example.com).');
  });

  test('isMarkdown', () => {
    assert.equal(isMarkdown(text('x')), true);
    assert.equal(isMarkdown('x'), false);
    assert.equal(isMarkdown({ kind: 'inline', description: 'text', text: 'x' }), false);
  });

  test('a value from another loaded copy is recognized', async () => {
    const other = await importCopy();
    assert.notEqual(other.link, link);
    const item = other.listItem(other.link('docs', 'https://example.com'));
    assert.equal(isMarkdown(item), true);
    assert.equal(list([item, strong('x')]).toString(), '- [docs](https://example.com)\n- **x**');
  });
});

describe('strong, emphasis, strikethrough', () => {
  testEach`
        value                                             | expected
        ${strong('pre-release')}                          | ${'**pre-release**'}
        ${emphasis('note')}                               | ${'_note_'}
        ${strikethrough(inlineCode('cSpell.oldSetting'))} | ${'~~`cSpell.oldSetting`~~'}
        ${strong(['When: ', emphasis('always')])}         | ${'**When: _always_**'}
    `('$expected', ({ value, expected }: { value: MDValue; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('in a list item', () => {
    const md = list([listItem(link('Danish', '../da.md'), ' ', strong('pre-release'), ' - Adds Danish')]);
    assert.equal(md.toString(), '- [Danish](../da.md) **pre-release** - Adds Danish');
  });

  test('block content throws', () => {
    // @ts-expect-error a list is not inline
    assert.throws(() => strong(list(['a'])), new TypeError('strong content must be inline, got a list'));
  });
});

describe('line breaks', () => {
  test('lineBreak is a Markdown hard break in a paragraph', () => {
    assert.equal(paragraph('one', lineBreak(), 'two').toString(), 'one\\\ntwo');
  });

  test('lineBreak in a list item', () => {
    assert.equal(list([['one', lineBreak(), 'two']]).toString(), '- one\\\n  two');
  });

  test('br is always <br/>', () => {
    assert.equal(paragraph('one', br(), 'two').toString(), 'one<br/>two');
    assert.equal(heading(2, ['A', br(), 'B']).toString(), '## A<br/>B');
  });
});

describe('toBlock', () => {
  test('a block is returned unchanged', () => {
    const block = list(['a']);
    assert.equal(toBlock(block), block);
    const blocks = [heading(2, 'A'), list(['a'])];
    assert.equal(toBlock(blocks), blocks);
  });

  test('inline content becomes a paragraph', () => {
    assert.equal(document(toBlock('Hello')).toString(), 'Hello\n');
    assert.equal(document(toBlock(['See ', link('docs', 'u')])).toString(), 'See [docs](u)\n');
  });

  test('each inline run becomes a paragraph, and blocks stay', () => {
    const md = document(toBlock(['Intro ', strong('x'), list(['a']), 'Outro']));
    assert.equal(md.toString(), 'Intro **x**\n\n- a\n\nOutro\n');
  });
});

describe('text', () => {
  test('text is inlineText', () => {
    assert.equal(text, inlineText);
  });

  test('a newline stays in the text', () => {
    assert.equal(paragraph(inlineText('a\n- b')).toString(), 'a\n\\- b');
  });
});

describe('placeholders', () => {
  test('placeholder() is inline, and blockPlaceholder() is a block', () => {
    assert.partialDeepStrictEqual(placeholder('a.b'), { kind: 'inline', description: 'a placeholder', name: 'a.b' });
    assert.partialDeepStrictEqual(blockPlaceholder('a.b'), { kind: 'block', description: 'a block placeholder' });
    assert.equal(heading(2, ['v', placeholder('v')]).toString(), '## v{@ v @}');
    assert.equal(document('Intro', blockPlaceholder('x')).toString(), 'Intro\n\n{@ x @}\n');
  });

  test('a block placeholder cannot go inside a line', () => {
    assert.throws(
      // @ts-expect-error a block placeholder is a block
      () => heading(2, blockPlaceholder('x')),
      new TypeError('heading content must be inline, got a block placeholder'),
    );
  });

  test('an invalid name throws', () => {
    assert.throws(() => blockPlaceholder('a..b'), new Error('invalid placeholder name: "a..b"'));
  });
});

describe('horizontalRule', () => {
  test('a line between sections, in the document style', () => {
    assert.equal(hr, horizontalRule);
    const md = document(paragraph('A'), horizontalRule(), 'B');
    assert.equal(md.toString(), 'A\n\n---\n\nB\n');
    assert.equal(md.withStyle({ rule: '*' }).toString(), 'A\n\n***\n\nB\n');
  });

  test('it cannot go inside a line', () => {
    // @ts-expect-error a horizontal rule is a block
    assert.throws(() => paragraph(hr()), new TypeError('paragraph content must be inline, got a horizontal rule'));
  });
});

describe('line endings at the edges', () => {
  testEach`
        value                                                                  | expected
        ${document('Fruit:\n', placeholder('fruit'), '\n')}                    | ${'Fruit:\n{@ fruit @}\n'}
        ${document(document('Fruit:\n', placeholder('fruit'), '\n'), 'yummy')} | ${'Fruit:\n{@ fruit @}\n\nyummy\n'}
        ${document('Fruit:\n', blockPlaceholder('fruit'))}                     | ${'Fruit:\n\n{@ fruit @}\n'}
        ${document('Intro', '\n', list(['x']))}                                | ${'Intro\n\n- x\n'}
        ${list([listItem('Langs\n', list(['en']))])}                           | ${'- Langs\n  - en'}
        ${paragraph('\n\na\nb\nc  \n\n')}                                      | ${'a\nb\nc'}
        ${heading(2, 'Title\n')}                                               | ${'## Title'}
        ${paragraph('a', lineBreak())}                                         | ${'a'}
        ${paragraph(lineBreak(), 'a', lineBreak(), 'b')}                       | ${'a\\\nb'}
        ${document('Fruit:\n', placeholder('fruit'), '\n', 'yummy')}           | ${'Fruit:\n{@ fruit @}\nyummy\n'}
    `('$expected', ({ value, expected }: { value: MDValue; expected: string }) => {
    assert.equal(value.toString(), expected);
  });
});

describe('blockText', () => {
  testEach`
        value                   | expected
        ${'a\nb\n\nc\n'}        | ${'a\nb\n\nc'}
        ${'one line'}           | ${'one line'}
        ${'a\n \t\nb'}          | ${'a\n\nb'}
        ${'\n\na\n\n\n\nb\n\n'} | ${'a\n\nb'}
        ${'a\r\n\r\nb\rc'}      | ${'a\n\nb\nc'}
        ${'a\n- b\n# c\n1. d'}  | ${'a\n\\- b\n\\# c\n1\\. d'}
        ${'a\n===\n\n    code'} | ${'a\n\\===\n\n&#x20;   code'}
        ${'a  \nb'}             | ${'a &#x20;\nb'}
        ${'see {@ x @}\n\n*b*'} | ${'see {@ x @}\n\n\\*b\\*'}
        ${''}                   | ${''}
    `('blockText($value)', ({ value, expected }: { value: string; expected: string }) => {
    assert.equal(blockText(value).toString(), expected);
  });

  test('a single paragraph is still blocks', () => {
    const md = blockText('a\nb');
    assert.equal(md.kind, 'block');
    assert.equal(document(md, list(['x'])).toString(), 'a\nb\n\n- x\n');
  });
});

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

  test('inline pieces in a row form a paragraph, as in a list item', () => {
    const md = document('See ', link('the docs', 'u'), '.', list(['a']), 'More');
    assert.equal(md.toString(), 'See [the docs](u).\n\n- a\n\nMore\n');
  });

  test('a string is inline text and never splits', () => {
    assert.equal(document('a\n\nb').toString(), 'a&#xA;&#xA;b\n');
  });

  test('a list item is not document content', () => {
    // @ts-expect-error a list item goes only in a list
    assert.throws(() => document(listItem('a')), new TypeError('document content must be inline, got a list item'));
  });
});

describe('errors', () => {
  test('a block where only inline content can go', () => {
    // @ts-expect-error a list is not inline
    assert.throws(() => heading(2, list(['a'])), new TypeError('heading content must be inline, got a list'));
  });

  test('an array that mixes inline and blocks', () => {
    // @ts-expect-error a code block is not inline
    assert.throws(() => paragraph(['a', codeBlock('x')]), TypeError);
  });

  test('a heading depth outside 1 to 6', () => {
    // @ts-expect-error 7 is not a heading depth
    assert.throws(() => heading(7, 'x'), /heading depth must be 1 to 6, got 7/);
  });
});

// Loads a second copy of the package: `?copy` gives index.ts, and each local module it imports, a new module instance.
async function importCopy(): Promise<typeof Builders> {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (!context.parentURL?.endsWith('?copy') || resolved.url.includes('/node_modules/')) return resolved;
      return { ...resolved, url: `${resolved.url}?copy` };
    },
  });
  const copy = './index.ts?copy';
  return import(copy);
}
