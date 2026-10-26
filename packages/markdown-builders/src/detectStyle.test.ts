import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { detectMarkdownStyle, firstNonSpace, orderedMarkerAt } from './detectStyle.ts';

function parse(content: string) {
  return unified().use(remarkParse).use(remarkGfm).parse(content);
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
    const content = '1) one\n2) two\n';
    assert.equal(detectMarkdownStyle(parse(content), content).bulletOrdered, ')');
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

// Not reachable via detectMarkdownStyle (see the helpers' doc comments) —
// tested directly against synthetic offsets instead.
describe('firstNonSpace', () => {
  test('skips spaces and tabs to find the marker', () => {
    assert.equal(firstNonSpace(' \t- item', 0), '-');
  });

  test('returns the character at offset when there is no leading whitespace', () => {
    assert.equal(firstNonSpace('- item', 0), '-');
  });
});

describe('orderedMarkerAt', () => {
  test('skips spaces and tabs, then digits, to find the delimiter', () => {
    assert.equal(orderedMarkerAt(' \t12. item', 0), '.');
  });

  test('returns the delimiter when there is no leading whitespace', () => {
    assert.equal(orderedMarkerAt('1) item', 0), ')');
  });
});
