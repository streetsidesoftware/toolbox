import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { GitHubError } from '../github/index.ts';
import { fakeGitHub } from '../testing/fake-github.ts';
import { findGitHubFiles } from './find.ts';

const source = { repo: 'owner/repo' };

const files: Record<string, string> = {
  'README.md': '',
  'img/a.png': '',
  'img/b.svg': '',
  'img/.hidden.png': '',
  'img/deeper/c.png': '',
  'packages/one/README.md': '',
  'packages/two/notes.md': '',
  'packages/three/README.md': '',
  'packages/three/src/index.ts': '',
};

describe('findGitHubFiles', () => {
  testEach`
    pattern                   | expected
    ${'img/*.png'}            | ${['img/a.png']}
    ${'img/*'}                | ${['img/a.png', 'img/b.svg']}
    ${'img/*.{png,svg}'}      | ${['img/a.png', 'img/b.svg']}
    ${'img/?.png'}            | ${['img/a.png']}
    ${'img/[ab].*'}           | ${['img/a.png', 'img/b.svg']}
    ${'img/.*'}               | ${['img/.hidden.png']}
    ${'packages/*/README.md'} | ${['packages/one/README.md', 'packages/three/README.md']}
    ${'packages/*/src/*.ts'}  | ${['packages/three/src/index.ts']}
  `('finds $expected for $pattern', async ({ pattern, expected }: { pattern: string; expected: string[] }, t) => {
    fakeGitHub(t, files);

    assert.deepEqual(await findGitHubFiles(source, [pattern]), { files: expected, unmatched: [] });
  });

  test('keeps a path given in full as it is, without a request', async (t) => {
    const requests = fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/missing.png', 'README.md'], { exclude: ['*'] });

    assert.deepEqual(found, { files: ['img/missing.png', 'README.md'], unmatched: [] });
    assert.deepEqual(requests, []);
  });

  test('skips the files a pattern matches that an exclude matches', async (t) => {
    fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/*', 'packages/*/README.md'], {
      exclude: ['*.svg', 'packages/one'],
    });

    assert.deepEqual(found.files, ['img/a.png', 'packages/three/README.md']);
  });

  testEach`
    reason                       | pattern        | exclude
    ${'nothing matches'}         | ${'img/*.gif'} | ${[]}
    ${'every match is excluded'} | ${'img/*.png'} | ${['a.png']}
  `(
    'lists a pattern as unmatched when $reason',
    async ({ pattern, exclude }: { pattern: string; exclude: string[] }, t) => {
      fakeGitHub(t, files);

      assert.deepEqual(await findGitHubFiles(source, [pattern, 'README.md'], { exclude }), {
        files: ['README.md'],
        unmatched: [pattern],
      });
    },
  );

  test('lists a file found twice once', async (t) => {
    fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/a.png', 'img/*.png', 'img/*']);

    assert.deepEqual(found, { files: ['img/a.png', 'img/b.svg'], unmatched: [] });
  });

  test('lists only the folders the pattern reaches, from the ref', async (t) => {
    const requests = fakeGitHub(t, files);
    await findGitHubFiles({ repo: 'owner/repo', ref: 'v2' }, ['packages/*/README.md']);

    assert.deepEqual(
      requests.map((request) => request.url),
      [
        'https://api.github.com/repos/owner/repo/contents/packages?ref=v2',
        'https://api.github.com/repos/owner/repo/contents/packages/one?ref=v2',
        'https://api.github.com/repos/owner/repo/contents/packages/two?ref=v2',
        'https://api.github.com/repos/owner/repo/contents/packages/three?ref=v2',
      ],
    );
  });

  test('finds nothing below a file', async (t) => {
    fakeGitHub(t, files);

    assert.deepEqual(await findGitHubFiles(source, ['README.md/*']), { files: [], unmatched: ['README.md/*'] });
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

    assert.deepEqual((await findGitHubFiles(source, ['docs/*.md'])).files, ['docs/a.md']);
  });

  test('rejects with the error of a folder that cannot be listed', async (t) => {
    fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, ['README.md', 'missing/*.png']), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 404);
      return true;
    });
  });

  test('refuses a pattern with a wildcard in its first segment, without a request', async (t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, ['*.md']), {
      message: 'A pattern must name a folder before its first wildcard, such as static/*.md.',
    });
    assert.deepEqual(requests, []);
  });

  test('refuses a source that is not a repository, before any request', async (t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles({ repo: '../..' }, ['img/*']), {
      message: 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
    });
    assert.deepEqual(requests, []);
  });

  test('refuses a lone path in place of a list', async (t) => {
    fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, 'img/*'), {
      message: "The paths must be a list of paths, such as ['static/sponsor.md'].",
    });
  });

  test('passes the signal on to each listing', async (t) => {
    const requests = fakeGitHub(t, files);
    const controller = new AbortController();
    await findGitHubFiles(source, ['img/*'], { signal: controller.signal });

    assert.equal(requests[0]?.signal, controller.signal);
  });
});
