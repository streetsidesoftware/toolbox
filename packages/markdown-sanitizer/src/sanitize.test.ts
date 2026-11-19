import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { findHidden } from './findHidden.ts';
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
  `('shows $name as code', ({ markdown, revealed }: { markdown: string; revealed: string }) => {
    assert.equal(sanitize(markdown, 'reveal'), revealed);
    assert.deepEqual(
      findHidden(revealed).filter((found) => found.kind !== 'invisible'),
      [],
    );
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
    ${'a comment block'}                | ${'a\n\n<!-- note -->\n\nb'}              | ${'a\n\n\n\nb'}
    ${'a comment left open'}            | ${'a\n\n<!-- open\n\nb'}                  | ${'a\n\n'}
    ${'a definition'}                   | ${'[//]: # (note)\n\nVisible'}            | ${'\n\nVisible'}
    ${'invisible characters'}           | ${'a\u{E0041}b &#xFE01;'}                 | ${'ab '}
    ${'a comment that removal forms'}   | ${'<!-<!-- -->- x -->'}                   | ${''}
    ${'a reference that removal forms'} | ${'&#xE00\u{E0041}41;'}                   | ${''}
  `('removes $name', ({ markdown, removed }: { markdown: string; removed: string }) => {
    assert.equal(sanitize(markdown, 'remove'), removed);
  });

  test('leaves Markdown that hides nothing as it is', () => {
    const markdown = 'I like \u2764\uFE0F and `<!-- code -->`, @\u200Bname.\n';
    assert.equal(sanitize(markdown, 'remove'), markdown);
  });

  test('gives up on Markdown that keeps hiding text', () => {
    const markdown = '<!-'.repeat(101) + '<!-- -->' + '- x -->'.repeat(101);
    assert.throws(() => sanitize(markdown, 'remove'), {
      message: 'Markdown must not hide text that is still hidden after 100 passes of removal',
    });
  });
});
