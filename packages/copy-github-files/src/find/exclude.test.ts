import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { isExcluded } from './exclude.ts';

describe('isExcluded', () => {
  testEach`
    globs                              | filePath                           | expected
    ${['banner.png']}                  | ${'img/sponsor/banner.png'}        | ${true}
    ${['banner.png']}                  | ${'img/sponsor/logo.png'}          | ${false}
    ${['banner.png']}                  | ${'banner.png'}                    | ${true}
    ${['*-dark-*.png']}                | ${'img/cspell-dark-172px.png'}     | ${true}
    ${['drafts']}                      | ${'docs/drafts/note.md'}           | ${true}
    ${['drafts/']}                     | ${'docs/drafts/note.md'}           | ${true}
    ${['drafts/']}                     | ${'docs/drafts'}                   | ${false}
    ${['img/banner.png']}              | ${'img/banner.png'}                | ${true}
    ${['img/banner.png']}              | ${'website/img/banner.png'}        | ${false}
    ${['/img/banner.png']}             | ${'img/banner.png'}                | ${true}
    ${['website/img']}                 | ${'website/img/banner.png'}        | ${true}
    ${['website/**/banner.png']}       | ${'website/static/img/banner.png'} | ${true}
    ${['img/*', '!img/*.png']}         | ${'img/logo.png'}                  | ${false}
    ${['img/*', '!img/*.png']}         | ${'img/logo.svg'}                  | ${true}
    ${['!img/*.png', 'img/*']}         | ${'img/logo.png'}                  | ${false}
    ${['drafts/', '!drafts/keep.png']} | ${'drafts/keep.png'}               | ${false}
    ${['!logo.png']}                   | ${'img/logo.png'}                  | ${false}
    ${[]}                              | ${'img/logo.png'}                  | ${false}
  `(
    'excludes $filePath with $globs: $expected',
    ({ globs, filePath, expected }: { globs: string[]; filePath: string; expected: boolean }) => {
      assert.equal(isExcluded(filePath, globs), expected);
    },
  );
});
