import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { findHidden } from '../findHidden.ts';
import { sanitize } from './sanitize.ts';

describe('sanitize reveal', () => {
  testEach`
    name                                 | markdown                                      | revealed
    ${'a comment in a line'}             | ${'Fix the <!-- secret --> parser.'}          | ${'Fix the `<!-- secret -->` parser.'}
    ${'a comment holding backticks'}     | ${'a <!-- `y` --> z'}                         | ${'a ``<!-- `y` -->`` z'}
    ${'a comment in a table cell'}       | ${'| a |\n|---|\n| x <!-- c \\| d --> |'}     | ${'| a |\n|---|\n| x `<!-- c \\| d -->` |'}
    ${'a comment block'}                 | ${'a\n\n<!-- note\nline 2 -->\n\nb'}          | ${'a\n\n```\n<!-- note\nline 2 -->\n```\n\nb'}
    ${'a comment block in a quote'}      | ${'> a\n> <!-- x\n> y -->\n> b'}              | ${'> a\n> ```\n> <!-- x\n> > y -->\n> ```\n> b'}
    ${'a comment block in a list'}       | ${'- <!-- x -->\n  more'}                     | ${'- ```\n  <!-- x -->\n  ```\n  more'}
    ${'text after a comment block'}      | ${'<!-- x --> after'}                         | ${'```\n<!-- x -->\n```\n after'}
    ${'a comment inside HTML'}           | ${'<div>\n<!-- a & b -->\nshown\n</div>'}     | ${'<div>\n<code>&lt;!-- a &amp; b --&gt;</code>\nshown\n</div>'}
    ${'a comment left open in HTML'}     | ${'<div><!-- x\n\nrest'}                      | ${'<div>\n\n```\n<!-- x\n\nrest\n```'}
    ${'a comment left open in a quote'}  | ${'> <!-- open\n\nafter'}                     | ${'> ```\n> <!-- open\n> \n> after\n> ```'}
    ${'a definition'}                    | ${'[//]: # (hidden text)\n\nVisible'}         | ${'```\n[//]: # (hidden text)\n```\n\nVisible'}
    ${'a footnote'}                      | ${'Text.\n\n[^1]: Hidden.'}                   | ${'Text.\n\n```\n[^1]: Hidden.\n```'}
    ${'a block holding a fence'}         | ${'<!--\n```\n-->'}                           | ${'````\n<!--\n```\n-->\n````'}
    ${'a comment between code spans'}    | ${'`a`<!-- x -->`b`'}                         | ${'`a` ``<!-- x -->`` `b`'}
    ${'a comment after a stray backtick'} | ${'a`<!-- x --> b'}                          | ${'a` ``<!-- x -->`` b'}
    ${'two comments side by side'}       | ${'a <!-- x --><!-- y --> b'}                 | ${'a `<!-- x -->` `<!-- y -->` b'}
    ${'a block with CRLF line endings'}  | ${'a\r\n\r\n<!-- x\r\ny -->\r\n\r\nb'}        | ${'a\r\n\r\n```\r\n<!-- x\r\ny -->\r\n```\r\n\r\nb'}
    ${'a block and HTML in one node'}    | ${'<!-- a --> text <!-- b -->'}               | ${'```\n<!-- a -->\n```\n text <code>&lt;!-- b --&gt;</code>'}
  `('shows $name as code', ({ markdown, revealed }: { markdown: string; revealed: string }) => {
    assert.equal(sanitize(markdown, 'reveal'), revealed);
    assert.deepEqual(findHidden(revealed), []);
  });

  testEach`
    name                              | markdown                                   | revealed
    ${'tag characters in text'}       | ${'fix\u{E0049}\u{E0067} it'}              | ${'fix`\\u{E0049}\\u{E0067}` it'}
    ${'a variation selector'}         | ${'a\uFE01 b'}                             | ${'a`\\u{FE01}` b'}
    ${'a reference in text'}          | ${'a &#xE0041; b'}                         | ${'a `&#xE0041;` b'}
    ${'a character in code'}          | ${'`a\u{E0041}b`'}                         | ${'`a\\u{E0041}b`'}
    ${'characters in HTML'}           | ${'<div>&#xE0041;\u{E0042}</div>'}         | ${'<div>&amp;#xE0041;\\u{E0042}</div>'}
    ${'a character in a comment'}     | ${'x <!-- a\u{E0041} --> y'}               | ${'x `<!-- a\\u{E0041} -->` y'}
    ${'a character in a code block'}  | ${'<!--\n\u{E0041}\n-->'}                  | ${'```\n<!--\n\\u{E0041}\n-->\n```'}
    ${'a character after a backslash'} | ${'C:\\\u{E0041}x'}                      | ${'C:\\ `\\u{E0041}`x'}
  `('shows $name as escapes', ({ markdown, revealed }: { markdown: string; revealed: string }) => {
    assert.equal(sanitize(markdown, 'reveal'), revealed);
    assert.deepEqual(findHidden(revealed), []);
  });

  test('leaves an emoji alone', () => {
    assert.equal(sanitize('I like \u2764\uFE0F.', 'reveal'), 'I like \u2764\uFE0F.');
  });

  test('leaves Markdown that hides nothing as it is', () => {
    const markdown = '# Title\n\n- a\n- b\n\n```\n<!-- code -->\n```\n';
    assert.equal(sanitize(markdown, 'reveal'), markdown);
  });
});

describe('sanitize remove', () => {
  testEach`
    name                                | markdown                                  | removed
    ${'a comment in a line'}            | ${'Fix the <!-- secret --> parser.'}      | ${'Fix the  parser.'}
    ${'a comment block'}                | ${'a\n\n<!-- note -->\n\nb'}              | ${'a\n\n\u{200B}\n\nb'}
    ${'a comment left open'}            | ${'a\n\n<!-- open\n\nb'}                  | ${'a\n\n\u{200B}'}
    ${'a definition'}                   | ${'[//]: # (note)\n\nVisible'}            | ${'\u{200B}\n\nVisible'}
    ${'a footnote'}                     | ${'Text.\n\n[^1]: Hidden.'}               | ${'Text.\n\n\u{200B}'}
    ${'a comment in a quote'}           | ${'> a <!-- x --> b'}                     | ${'> a  b'}
    ${'what only a footnote uses'}      | ${'Text.\n\n[^9]: see [x]\n\n[x]: # (note)'} | ${'Text.\n\n\u{200B}\n\n\u{200B}'}
    ${'invisible characters'}           | ${'a\u{E0041}b &#xFE01;'}                 | ${'a\u{200B}b '}
    ${'a comment hiding a comment'}     | ${'<!-<!-- -->- x -->'}                   | ${'<!-\u{200B}- x -->'}
    ${'a character in a reference'}     | ${'&#xE00\u{E0041}41;'}                   | ${'&#xE00\u{200B}41;'}
    ${'a comment before a definition'}  | ${'<!-- c -->[d]: # (z)'}                 | ${'\u{200B}[d]: # (z)'}
    ${'a comment before indented text'} | ${'   <!-- c -->after'}                   | ${'   \u{200B}after'}
  `('removes $name', ({ markdown, removed }: { markdown: string; removed: string }) => {
    assert.equal(sanitize(markdown, 'remove'), removed);
    assert.deepEqual(findHidden(removed), []);
  });

  testEach`
    name                          | markdown                                      | removed
    ${'a word'}                   | ${'a <!-- x -->b'}                            | ${'a b'}
    ${'a word and a tab'}         | ${'a\t<!-- x -->b'}                           | ${'a\tb'}
    ${'a word and two spaces'}    | ${'&#xE00  <!-- x -->41;'}                    | ${'&#xE00  41;'}
    ${'indentation'}              | ${'   <!-- x -->[d]: # (z)'}                  | ${'   \u{200B}[d]: # (z)'}
    ${'a list marker'}            | ${'- <!-- x -->[d]: # (z)'}                   | ${'- \u{200B}[d]: # (z)'}
    ${'a star list marker'}       | ${'* <!-- x -->[d]: # (z)'}                   | ${'* \u{200B}[d]: # (z)'}
    ${'a plus list marker'}       | ${'+ <!-- x -->[d]: # (z)'}                   | ${'+ \u{200B}[d]: # (z)'}
    ${'an ordered list marker'}   | ${'1. <!-- x -->[d]: # (z)'}                  | ${'1. \u{200B}[d]: # (z)'}
    ${'a parenthesis list marker'} | ${'1) <!-- x -->[d]: # (z)'}                 | ${'1) \u{200B}[d]: # (z)'}
    ${'a quote marker'}           | ${'> <!-- x -->[d]: # (z)'}                   | ${'> \u{200B}[d]: # (z)'}
    ${'a footnote label'}         | ${'a[^1]\n\n[^1]: <!-- x -->[d]: # (z)'}      | ${'a[^1]\n\n[^1]: \u{200B}[d]: # (z)'}
    ${'a byte order mark'}        | ${'\uFEFF <!-- x -->[d]: # (z)'}            | ${'\uFEFF \u{200B}[d]: # (z)'}
  `('removes hidden text after spaces and $name', ({ markdown, removed }: { markdown: string; removed: string }) => {
    assert.equal(sanitize(markdown, 'remove'), removed);
    assert.deepEqual(findHidden(removed), []);
  });

  test('leaves Markdown that hides nothing as it is', () => {
    const markdown = 'I like \u2764\uFE0F and `<!-- code -->`, @\u200Bname.\n';
    assert.equal(sanitize(markdown, 'remove'), markdown);
  });

  test('removes deeply nested comments in one pass', () => {
    const markdown = '<!-'.repeat(101) + '<!-- -->' + '- x -->'.repeat(101);
    assert.deepEqual(findHidden(sanitize(markdown, 'remove')), []);
  });
});
