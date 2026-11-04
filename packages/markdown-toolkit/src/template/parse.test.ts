import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { document, link, parse, table, template, toBlock } from '../index.ts';

describe('parse', () => {
  test('a single paragraph is inline', () => {
    const md = parse('  Hello *you*\n');
    if (md.kind !== 'inline') throw new Error('expected inline');
    assert.equal(md.toString(), 'Hello *you*');
    assert.equal(link(md, 'https://example.com').toString(), '[Hello _you_](https://example.com)');
  });

  testEach`
        markdown
        ${''}
        ${'  '}
        ${'\n'}
    `('text with no content is inline: $markdown', ({ markdown }: { markdown: string }) => {
    const md = parse(markdown);
    assert.ok(md.kind === 'inline');
    assert.equal(md.toString(), '');
    assert.equal(table(['T'], [[md]]).toString(), '| T |\n| - |\n|   |');
    assert.equal(document('a', md, 'b').toString(), 'a\n\nb\n');
  });

  test('an empty link stays', () => {
    assert.equal(parse('a []() b').toString(), 'a []() b');
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

describe('autolink', () => {
  testEach`
        markdown                      | expected
        ${'<https://e.com/{@a@}>'}    | ${'<https://e.com/{@a@}>'}
        ${'https://e.com/{@a_b@}'}    | ${'<https://e.com/{@a_b@}>'}
        ${'<mailto:{@a@}@e.com>'}     | ${'<mailto:{@a@}@e.com>'}
    `(
    'a placeholder in an autolink keeps its form: $markdown',
    ({ markdown, expected }: { markdown: string; expected: string }) => {
      assert.equal(parse(markdown).toString(), expected);
      assert.equal(template(markdown, {}).toString(), expected);
    },
  );

  // Each row is a link remark doesn't write as `<…>`, one per check in `asAutolinkText`. Joined, its `_` would be escaped.
  testEach`
        markdown
        ${'See [the {@ a_ @} page](https://e.com).'}
        ${'[{@a_@}]({@a_@})'}
        ${'[https://e.com/{@a_@} x](<https://e.com/{@a_@} x>)'}
        ${'[https://e.com/{@a_@}](https://e.com/{@a_@} "t")'}
    `(
    'a placeholder in the text of any other link is never escaped: $markdown',
    ({ markdown }: { markdown: string }) => {
      assert.equal(parse(markdown).toString(), markdown);
      assert.equal(template(markdown, {}).toString(), markdown);
    },
  );
});
