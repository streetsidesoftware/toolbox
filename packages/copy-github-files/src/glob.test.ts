import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { fakeGitHub } from './fake-github.ts';
import { GitHubError } from './github.ts';
import { findFiles, isExcluded, isPattern, parseExcludes } from './glob.ts';

const source = { repo: 'owner/repo' };

describe('isPattern', () => {
  testEach`
    repoPath                       | expected
    ${'static/sponsor.md'}         | ${false}
    ${'static/img/*.png'}          | ${true}
    ${'static/img/logo-?.png'}     | ${true}
    ${'static/img/logo-[ab].png'}  | ${true}
    ${'static/img/logo.{png,svg}'} | ${true}
    ${'packages/*/README.md'}      | ${true}
    ${'static/img/logo+(a).png'}   | ${false}
  `('says $repoPath is a pattern: $expected', ({ repoPath, expected }: { repoPath: string; expected: boolean }) => {
    assert.equal(isPattern(repoPath), expected);
  });
});

describe('findFiles', () => {
  const files = {
    'README.md': '',
    'CHANGELOG.md': '',
    'img/a.png': '',
    'img/b.svg': '',
    'img/.hidden.png': '',
    'img/deeper/c.png': '',
    'packages/one/README.md': '',
    'packages/two/notes.md': '',
    'packages/three/README.md': '',
    'packages/three/src/index.ts': '',
  };

  testEach`
    pattern                    | expected
    ${'img/*.png'}             | ${['img/a.png']}
    ${'img/*'}                 | ${['img/a.png', 'img/b.svg']}
    ${'img/*.{png,svg}'}       | ${['img/a.png', 'img/b.svg']}
    ${'img/.*'}                | ${['img/.hidden.png']}
    ${'*.md'}                  | ${['README.md', 'CHANGELOG.md']}
    ${'packages/*/README.md'}  | ${['packages/one/README.md', 'packages/three/README.md']}
    ${'packages/*/src/*.ts'}   | ${['packages/three/src/index.ts']}
    ${'img/*.gif'}             | ${[]}
  `('finds $expected for $pattern', async ({ pattern, expected }: { pattern: string; expected: string[] }, t) => {
    fakeGitHub(t, files);

    assert.deepEqual(await findFiles(source, pattern, {}), expected);
  });

  test('lists only the folders the pattern reaches', async (t) => {
    const requests = fakeGitHub(t, files);
    await findFiles(source, 'packages/*/README.md', {});

    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      [
        '/repos/owner/repo/contents/packages',
        '/repos/owner/repo/contents/packages/one',
        '/repos/owner/repo/contents/packages/two',
        '/repos/owner/repo/contents/packages/three',
      ],
    );
  });

  test('lists from the ref', async (t) => {
    const requests = fakeGitHub(t, files);
    await findFiles({ repo: 'owner/repo', ref: 'v2' }, 'img/*.png', {});

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/img?ref=v2');
  });

  test('gives the status when the folder before the first wildcard is missing', async (t) => {
    fakeGitHub(t, files);

    await assert.rejects(findFiles(source, 'missing/*.png', {}), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 404);
      return true;
    });
  });

  test('finds no folder at a file', async (t) => {
    fakeGitHub(t, files);

    await assert.rejects(findFiles(source, 'README.md/*', {}), {
      message: 'The path names a file, not a folder.',
    });
  });

  test('never matches a symlink or a submodule', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      const entries = [
        { type: 'file', name: 'a.md', path: 'docs/a.md' },
        { type: 'symlink', name: 'b.md', path: 'docs/b.md' },
        { type: 'submodule', name: 'c.md', path: 'docs/c.md' },
      ];
      return new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json' } });
    });

    assert.deepEqual(await findFiles(source, 'docs/*.md', {}), ['docs/a.md']);
  });

  test('refuses a path outside the repository, without a request', async (t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findFiles(source, '../*.md', {}), {
      message:
        'A path must be written from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    });
    assert.deepEqual(requests, []);
  });
});

describe('isExcluded', () => {
  testEach`
    globs                                        | filePath                              | expected
    ${['banner.png']}                            | ${'img/sponsor/banner.png'}           | ${true}
    ${['banner.png']}                            | ${'img/sponsor/logo.png'}             | ${false}
    ${['*-dark-*.png']}                          | ${'img/cspell-dark-172px.png'}        | ${true}
    ${['drafts']}                                | ${'docs/drafts/note.md'}              | ${true}
    ${['drafts/']}                               | ${'docs/drafts/note.md'}              | ${true}
    ${['drafts/']}                               | ${'docs/drafts'}                      | ${false}
    ${['img/banner.png']}                        | ${'img/banner.png'}                   | ${true}
    ${['img/banner.png']}                        | ${'website/img/banner.png'}           | ${false}
    ${['/img/banner.png']}                       | ${'img/banner.png'}                   | ${true}
    ${['website/img']}                           | ${'website/img/banner.png'}           | ${true}
    ${['website/**/banner.png']}                 | ${'website/static/img/banner.png'}    | ${true}
    ${['**/banner.png']}                         | ${'website/static/img/banner.png'}    | ${true}
    ${['img/*', '!img/*.png']}                   | ${'img/logo.png'}                     | ${false}
    ${['img/*', '!img/*.png']}                   | ${'img/logo.svg'}                     | ${true}
    ${['!img/*.png', 'img/*']}                   | ${'img/logo.png'}                     | ${false}
    ${['drafts/', '!drafts/keep.png']}           | ${'drafts/keep.png'}                  | ${false}
    ${['!logo.png']}                             | ${'img/logo.png'}                     | ${false}
    ${[]}                                        | ${'img/logo.png'}                     | ${false}
  `(
    'excludes $filePath with $globs: $expected',
    ({ globs, filePath, expected }: { globs: string[]; filePath: string; expected: boolean }) => {
      assert.equal(isExcluded(filePath, parseExcludes(globs)), expected);
    },
  );
});

describe('parseExcludes', () => {
  testEach`
    glob
    ${''}
    ${'!'}
    ${'/'}
    ${'!/'}
  `('refuses the glob "$glob"', ({ glob }: { glob: string }) => {
    assert.throws(() => parseExcludes([glob]), {
      message: 'A glob to exclude must name a file or folder, such as banner.png.',
    });
  });

  test('refuses a lone glob in place of a list', () => {
    assert.throws(() => parseExcludes('banner.png'), {
      message: "The exclude option must be a list of globs, such as ['banner.png'].",
    });
  });
});
