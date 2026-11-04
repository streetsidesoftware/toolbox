import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import type * as Builders from './index.ts';
import {
  blockComment,
  blockPlaceholder,
  blockText,
  br,
  codeBlock,
  comment,
  definitionList,
  details,
  document,
  emphasis,
  frontmatter,
  heading,
  horizontalRule,
  htmlTable,
  inlineCode,
  inlineComment,
  isMarkdown,
  lineBreak,
  link,
  list,
  listItem,
  paragraph,
  placeholder,
  strikethrough,
  strong,
  sub,
  sup,
  table,
  template,
  text,
} from './index.ts';
import type { MDElement } from './index.ts';

describe('element types', () => {
  testEach`
        value                                   | type                  | description
        ${text('a')}                            | ${'text'}             | ${'text'}
        ${placeholder('a')}                     | ${'placeholder'}      | ${'a placeholder'}
        ${blockPlaceholder('a')}                | ${'blockPlaceholder'} | ${'a block placeholder'}
        ${link('a', 'u')}                       | ${'link'}             | ${'a link'}
        ${strong('a')}                          | ${'strong'}           | ${'strong text'}
        ${emphasis('a')}                        | ${'emphasis'}         | ${'emphasized text'}
        ${strikethrough('a')}                   | ${'strikethrough'}    | ${'struck-through text'}
        ${sup('a')}                             | ${'sup'}              | ${'superscript text'}
        ${sub('a')}                             | ${'sub'}              | ${'subscript text'}
        ${inlineCode('a')}                      | ${'inlineCode'}       | ${'inline code'}
        ${lineBreak()}                          | ${'lineBreak'}        | ${'a line break'}
        ${br()}                                 | ${'br'}               | ${'a <br/>'}
        ${comment('a')}                         | ${'comment'}          | ${'a comment'}
        ${comment('a\nb')}                      | ${'comment'}          | ${'a multi-line comment'}
        ${inlineComment('a')}                   | ${'inlineComment'}    | ${'an inline comment'}
        ${blockComment('a')}                    | ${'blockComment'}     | ${'a block comment'}
        ${heading(1, 'a')}                      | ${'heading'}          | ${'a heading'}
        ${paragraph('a')}                       | ${'paragraph'}        | ${'a paragraph'}
        ${horizontalRule()}                     | ${'horizontalRule'}   | ${'a horizontal rule'}
        ${codeBlock('a')}                       | ${'codeBlock'}        | ${'a code block'}
        ${listItem('a')}                        | ${'listItem'}         | ${'a list item'}
        ${list(['a'])}                          | ${'list'}             | ${'a list'}
        ${details('a', 'b')}                    | ${'details'}          | ${'a details block'}
        ${definitionList([['a', 'b']])}         | ${'definitionList'}   | ${'a definition list'}
        ${table(['a'], [['b']])}                | ${'table'}            | ${'a table'}
        ${htmlTable(['a'], [['b']])}            | ${'htmlTable'}        | ${'an HTML table'}
        ${document('a')}                        | ${'document'}         | ${'a document'}
        ${frontmatter('a: 1')}                  | ${'frontmatter'}      | ${'frontmatter'}
        ${blockText('a')}                       | ${'fragment'}         | ${'a Markdown fragment'}
        ${template('a', {})}                    | ${'inlineFragment'}   | ${'an inline Markdown fragment'}
    `('$type', ({ value, type, description }: { value: MDElement; type: string; description: string }) => {
    assert.equal(value.type, type);
    assert.equal(value.description, description);
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
    assert.equal(isMarkdown({ kind: 'inline', type: 'text', description: 'text', text: 'x' }), false);
  });

  test('a value from another loaded copy is recognized', async () => {
    const other = await importCopy();
    assert.notEqual(other.link, link);
    const item = other.listItem(other.link('docs', 'https://example.com'));
    assert.equal(isMarkdown(item), true);
    assert.equal(list([item, strong('x')]).toString(), '- [docs](https://example.com)\n- **x**');
  });
});

describe('errors', () => {
  test('a list item where only inline content can go', () => {
    assert.throws(
      // @ts-expect-error a list item goes where blocks go
      () => heading(2, listItem('a')),
      new TypeError("heading content can't hold a list item; a list item goes in a list"),
    );
  });

  test('a block where only inline content can go', () => {
    // @ts-expect-error a list is not inline
    assert.throws(() => heading(2, list(['a'])), new TypeError('heading content must be inline, got a list'));
  });

  test('an array that mixes inline and blocks', () => {
    // @ts-expect-error a code block is not inline
    assert.throws(() => paragraph(['a', codeBlock('x')]), TypeError);
  });
});

// Load a second copy of the package: `?copy` gives index.ts, and each local module it imports, a new module instance.
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
