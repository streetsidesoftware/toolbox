import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { createExcludeFilter } from './exclude.ts';

describe('createExcludeFilter', () => {
  testEach`
    globs | entryPath | type | expected
    ${['banner.png']} | ${'img/sponsor/banner.png'} | ${'file'} | ${true}
    ${['banner.png']} | ${'img/sponsor/logo.png'} | ${'file'} | ${false}
    ${['banner.png']} | ${'banner.png'} | ${'file'} | ${true}
    ${['*-dark-*.png']} | ${'img/cspell-dark-172px.png'} | ${'file'} | ${true}
    ${['drafts']} | ${'docs/drafts'} | ${'dir'} | ${true}
    ${['drafts']} | ${'docs/drafts'} | ${'file'} | ${true}
    ${['drafts']} | ${'docs/drafts/note.md'} | ${'file'} | ${false}
    ${['drafts/']} | ${'docs/drafts'} | ${'dir'} | ${true}
    ${['drafts/']} | ${'docs/drafts'} | ${'file'} | ${false}
    ${['img/banner.png']} | ${'img/banner.png'} | ${'file'} | ${true}
    ${['img/banner.png']} | ${'website/img/banner.png'} | ${'file'} | ${false}
    ${['/img/banner.png']} | ${'img/banner.png'} | ${'file'} | ${true}
    ${['website/img']} | ${'website/img'} | ${'dir'} | ${true}
    ${['website/**/banner.png']} | ${'website/static/img/banner.png'} | ${'file'} | ${true}
    ${['img/*', '!img/*.png']} | ${'img/logo.png'} | ${'file'} | ${false}
    ${['img/*', '!img/*.png']} | ${'img/logo.svg'} | ${'file'} | ${true}
    ${['!img/*.png', 'img/*']} | ${'img/logo.png'} | ${'file'} | ${false}
    ${['drafts/', '!drafts/keep.png']} | ${'drafts'} | ${'dir'} | ${true}
    ${['drafts', '!docs/drafts']} | ${'docs/drafts'} | ${'dir'} | ${false}
    ${['drafts', '!docs/drafts']} | ${'img/drafts'} | ${'dir'} | ${true}
    ${['drafts', '!docs/drafts/']} | ${'docs/drafts'} | ${'file'} | ${true}
    ${['*.svg', '*.png', '!logo.svg']} | ${'img/logo.svg'} | ${'file'} | ${false}
    ${['*.svg', '*.png', '!logo.svg']} | ${'img/logo.png'} | ${'file'} | ${true}
    ${['*.svg', '!a.svg', '!b.svg']} | ${'img/b.svg'} | ${'file'} | ${false}
    ${['*.svg', '!a.svg', '!b.svg']} | ${'img/c.svg'} | ${'file'} | ${true}
    ${['!logo.png']} | ${'img/logo.png'} | ${'file'} | ${false}
    ${[]} | ${'img/logo.png'} | ${'file'} | ${false}
  `(
    'excludes the $type $entryPath with $globs: $expected',
    ({
      globs,
      entryPath,
      type,
      expected,
    }: {
      globs: string[];
      entryPath: string;
      type: 'file' | 'dir';
      expected: boolean;
    }) => {
      assert.equal(createExcludeFilter(globs)(entryPath, type), expected);
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
