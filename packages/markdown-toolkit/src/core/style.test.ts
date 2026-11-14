import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseTree } from './parse.ts';
import { detectMarkdownStyle } from './style.ts';

function parse(content: string) {
  return parseTree(content, false);
}

describe('detectMarkdownStyle', () => {
  test('falls back to defaults for a document with none of the detected constructs', () => {
    const content = 'Just a paragraph of text.\n';
    assert.deepEqual(detectMarkdownStyle(parse(content), content), {
      bullet: '-',
      emphasis: '_',
      fence: '`',
      fences: true,
      incrementListMarker: false,
      rule: '-',
      strong: '*',
    });
  });

  test('detects a non-default style used throughout the document', () => {
    const content = `\
* Item one
* Item two

Some *emphasis* and __strong__ text.

~~~js
const a = 1;
~~~

* * *
`;
    assert.deepEqual(detectMarkdownStyle(parse(content), content), {
      bullet: '*',
      emphasis: '*',
      fence: '~',
      fences: true,
      incrementListMarker: false,
      rule: '*',
      strong: '_',
    });
  });

  test('detects the ordered list marker', () => {
    const content = '10) one\n11) two\n';
    assert.equal(detectMarkdownStyle(parse(content), content).bulletOrdered, ')');
  });

  test('reads the markers of an indented list and rule', () => {
    const content = '   * one\n\n  ***\n\n   1) two\n';
    const { bullet, bulletOrdered, rule } = detectMarkdownStyle(parse(content), content);
    assert.deepEqual({ bullet, bulletOrdered, rule }, { bullet: '*', bulletOrdered: ')', rule: '*' });
  });

  test('picks the majority marker when a document mixes styles', () => {
    // A paragraph between each list forces them apart into separate `list`
    // nodes, so each block casts one vote for its own bullet marker.
    const content = `\
- one

text

- two

text

- three

text

* four
`;
    assert.equal(detectMarkdownStyle(parse(content), content).bullet, '-');
  });
});
