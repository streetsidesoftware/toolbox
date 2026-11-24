import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { createExcludeFilter } from './exclude.ts';

describe('createExcludeFilter', () => {
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
    ${['*.svg', '*.png', '!logo.svg']} | ${'img/logo.svg'}                  | ${false}
    ${['*.svg', '*.png', '!logo.svg']} | ${'img/logo.png'}                  | ${true}
    ${['*.svg', '!a.svg', '!b.svg']}   | ${'img/b.svg'}                     | ${false}
    ${['*.svg', '!a.svg', '!b.svg']}   | ${'img/c.svg'}                     | ${true}
    ${['!logo.png']}                   | ${'img/logo.png'}                  | ${false}
    ${[]}                              | ${'img/logo.png'}                  | ${false}
  `(
    'excludes $filePath with $globs: $expected',
    ({ globs, filePath, expected }: { globs: string[]; filePath: string; expected: boolean }) => {
      assert.equal(createExcludeFilter(globs)(filePath), expected);
    },
  );

  testEach`
    glob
    ${''}
    ${'/'}
    ${'//'}
    ${'!'}
    ${'!/'}
  `('refuses the glob $glob, which names nothing', ({ glob }: { glob: string }) => {
    assert.throws(() => createExcludeFilter(['logo.png', glob]), {
      message: 'A glob to exclude must name a file or folder, such as footer.md.',
    });
  });

  test('refuses a lone glob in place of a list', () => {
    assert.throws(() => createExcludeFilter('footer.md'), {
      message: "The exclude option must be a list of globs, such as ['footer.md'].",
    });
  });
});
