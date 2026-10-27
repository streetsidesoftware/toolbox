import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';
import { createUnindent } from '@streetsidesoftware/unindent';

import type { InlineContent } from './index.ts';
import {
  codeBlock,
  comment,
  definitionList,
  details,
  dl,
  document,
  inlineCode,
  link,
  list,
  parse,
  placeholder,
  text,
} from './index.ts';

const md = createUnindent({ trimFirstNewline: true, trimLastLine: true });

describe('details', () => {
  test('a plain-text summary is on one line, and the content has blank lines around it', () => {
    assert.equal(
      details('TypeScript:', codeBlock('{ a?: string }', 'ts')).toString(),
      md`
        <details>
        <summary>TypeScript:</summary>

        ${'```ts'}
        { a?: string }
        ${'```'}

        </details>
      `,
    );
  });

  testEach`
    summary                         | expected
    ${'a < b & c'}                  | ${'<summary>a &lt; b &amp; c</summary>'}
    ${'*not* emphasis'}             | ${'<summary>*not* emphasis</summary>'}
    ${text('a\n\n  b ')}            | ${'<summary>a\nb</summary>'}
    ${['Use ', text('<x>')]}        | ${'<summary>Use &lt;x></summary>'}
  `('summary text is HTML-escaped: $expected', ({ summary, expected }: { summary: string; expected: string }) => {
    assert.equal(details(summary).toString(), `<details>\n${expected}\n\n</details>`);
  });

  testEach`
    summary                                | expected
    ${['Use ', inlineCode('x')]}           | ${'Use `x`'}
    ${link('a]b', 'https://example.com')}  | ${'[a\\]b](https://example.com)'}
    ${placeholder('name')}                 | ${'{@ name @}'}
    ${comment('note')}                     | ${'<!-- note -->'}
  `(
    'a summary with Markdown has blank lines: $expected',
    ({ summary, expected }: { summary: InlineContent; expected: string }) => {
      assert.equal(
        details(summary, 'b').toString(),
        md`
          <details>
          <summary>

          ${expected}

          </summary>

          b

          </details>
        `,
      );
    },
  );

  test('inline content is a paragraph, and blocks follow', () => {
    assert.equal(
      details('S', 'See ', inlineCode('x'), '.', list(['a'])).toString(),
      md`
        <details>
        <summary>S</summary>

        See \`x\`.

        - a

        </details>
      `,
    );
  });

  test('it goes in a document', () => {
    assert.equal(
      document('Intro', details('S', 'b')).toString(),
      md`
        Intro

        <details>
        <summary>S</summary>

        b

        </details>
      ` + '\n',
    );
  });

  test('a block summary throws', () => {
    assert.throws(() => details(list(['a']) as never), new TypeError('details summary must be inline, got a list'));
  });
});

describe('definitionList', () => {
  test('plain-text terms are on one line, and definitions have blank lines around them', () => {
    assert.equal(
      definitionList([
        ['Name', inlineCode('cSpell.dark')],
        ['Description', parse('Decoration.\n\n- [a](b.md)\n')],
      ]).toString(),
      md`
        <dl>

        <dt>Name</dt>
        <dd>

        \`cSpell.dark\`

        </dd>

        <dt>Description</dt>
        <dd>

        Decoration.

        - [a](b.md)

        </dd>

        </dl>
      `,
    );
  });

  test('term text is HTML-escaped', () => {
    assert.equal(
      dl([['a < b & c', 'd']]).toString(),
      md`
        <dl>

        <dt>a &lt; b &amp; c</dt>
        <dd>

        d

        </dd>

        </dl>
      `,
    );
  });

  test('definition text is Markdown-escaped', () => {
    assert.equal(
      dl([['T', '*not* emphasis']]).toString(),
      md`
        <dl>

        <dt>T</dt>
        <dd>

        ${'\\*not\\* emphasis'}

        </dd>

        </dl>
      `,
    );
  });

  test('a term with Markdown has blank lines', () => {
    assert.equal(
      dl([[inlineCode('x'), 'y']]).toString(),
      md`
        <dl>

        <dt>

        \`x\`

        </dt>
        <dd>

        y

        </dd>

        </dl>
      `,
    );
  });

  test('a definition can mix inline and blocks', () => {
    assert.equal(
      dl([['T', ['See ', inlineCode('x'), list(['a'])]]]).toString(),
      md`
        <dl>

        <dt>T</dt>
        <dd>

        See \`x\`

        - a

        </dd>

        </dl>
      `,
    );
  });

  test('no entries', () => {
    assert.equal(dl([]).toString(), '<dl>\n\n</dl>');
  });

  test('a block term throws', () => {
    assert.throws(() => dl([[list(['a']) as never, 'b']]), new TypeError('definition term must be inline, got a list'));
  });

  test('an entry that is not a pair throws', () => {
    assert.throws(
      () => dl(['Name' as never]),
      new TypeError('definition list entry must be a [term, definition] pair, got a string'),
    );
  });
});
