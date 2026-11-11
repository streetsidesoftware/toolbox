import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { link, paragraph, strong } from '../index.ts';

describe('link', () => {
  test('an empty link stays', () => {
    assert.equal(paragraph('a', link('', 'u'), 'b').toString(), 'a[](u)b');
    assert.equal(paragraph(link('', '')).toString(), '[]()');
    assert.equal(paragraph(link(strong(''), '')).toString(), '[**&#x20;**]()');
  });
});
