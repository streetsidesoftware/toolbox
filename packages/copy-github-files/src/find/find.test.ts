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
    ${'packages/three/{src/*.ts,*.md}'} | ${['packages/three/src/index.ts', 'packages/three/README.md']}
    ${'packages/{one/*.md,*/*.md}'} | ${['packages/one/README.md', 'packages/two/notes.md', 'packages/three/README.md']}
    ${'img/{a.png,deeper/*.png}'} | ${['img/a.png', 'img/deeper/c.png']}
    ${'*.md'}                 | ${['README.md']}
    ${'*/*.png'}              | ${['img/a.png']}
    ${'*/*/README.md'}        | ${['packages/one/README.md', 'packages/three/README.md']}
    ${'{img,packages}/*'}     | ${['img/a.png', 'img/b.svg']}
    ${'{README.md,img/*.png}'} | ${['README.md', 'img/a.png']}
    ${'{,img/}*.{md,png}'}    | ${['README.md', 'img/a.png']}
    ${'{packages/two,img}/*'} | ${['packages/two/notes.md', 'img/a.png', 'img/b.svg']}
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
    reason                                              | pattern                  | exclude                                           | expected                                                 | folders
    ${'skips an excluded folder'}                             | ${'packages/*/*.md'}     | ${['two', 'three']}                               | ${['packages/one/README.md']}                            | ${['packages', 'packages/one']}
    ${'skips an excluded folder, even with a ! glob for a file in it'}    | ${'packages/*/*.md'}     | ${['two', 'three', '!packages/two/notes.md']}     | ${['packages/one/README.md']}                            | ${['packages', 'packages/one']}
    ${'lists a folder that a ! glob keeps'}             | ${'packages/*/*.md'}     | ${['two', 'three', '!packages/two']}              | ${['packages/one/README.md', 'packages/two/notes.md']}   | ${['packages', 'packages/one', 'packages/two']}
    ${'lists a folder when only its files are excluded'}      | ${'packages/*/*.md'}     | ${['packages/two/*', '!packages/two/notes.md']}   | ${['packages/one/README.md', 'packages/two/notes.md', 'packages/three/README.md']} | ${['packages', 'packages/one', 'packages/two', 'packages/three']}
    ${'starts in the root'} | ${'{img,packages}/*.png'} | ${['packages']} | ${['img/a.png']} | ${['', 'img']}
    ${'skips the folder it starts in'} | ${'packages/three/*.md'} | ${['packages']}                                  | ${[]}                                                    | ${[]}
  `(
    'lists only the folders it needs: $reason',
    async (
      {
        pattern,
        exclude,
        expected,
        folders,
      }: { pattern: string; exclude: string[]; expected: string[]; folders: string[] },
      t,
    ) => {
      const requests = fakeGitHub(t, files);
      const found = await findGitHubFiles(source, [pattern], { exclude });

      assert.deepEqual(found.files, expected);
      assert.deepEqual(
        requests.map((request) => request.url.replace('https://api.github.com/repos/owner/repo/contents/', '')),
        folders,
      );
    },
  );

  test('reads the excludes once, for every pattern', async (t) => {
    fakeGitHub(t, files);
    const exclude = new Set(['*.svg', 'packages/one']).values();
    const found = await findGitHubFiles(source, ['img/*', 'packages/*/README.md'], { exclude });

    assert.deepEqual(found.files, ['img/a.png', 'packages/three/README.md']);
  });

  test('refuses an exclude that names nothing, before any request', async (t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, ['img/*'], { exclude: ['/'] }), {
      message: 'A glob to exclude must name a file or folder, such as footer.md.',
    });
    assert.deepEqual(requests, []);
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

  test('leaves out a file an expansion names when it is missing or excluded', async (t) => {
    fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/{missing.png,a.png,deeper/*.png}'], { exclude: ['a.png'] });

    assert.deepEqual(found, { files: ['img/deeper/c.png'], unmatched: [] });
  });

  test('lists a pattern as unmatched only when none of its expansions match', async (t) => {
    fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/{*.gif,deeper/*.gif}', 'img/{*.gif,deeper/*.png}']);

    assert.deepEqual(found, { files: ['img/deeper/c.png'], unmatched: ['img/{*.gif,deeper/*.gif}'] });
  });

  test('looks up a pattern given twice once', async (t) => {
    const requests = fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/*.gif', 'img/*.gif']);

    assert.deepEqual(found, { files: [], unmatched: ['img/*.gif'] });
    assert.equal(requests.length, 1);
  });

  testEach`
    patterns                                          | folders
    ${['img/*.png', 'img/*.svg']}                     | ${['img']}
    ${['packages/*/README.md', 'packages/*/*.ts']}    | ${['packages', 'packages/one', 'packages/two', 'packages/three']}
    ${['packages/*/{README.md,src/*.ts}']}            | ${['packages', 'packages/one', 'packages/two', 'packages/three', 'packages/three/src']}
    ${['*.md', '{README.md,img/*.png}', 'img/*']}     | ${['', 'img']}
  `(
    'lists each folder once for $patterns',
    async ({ patterns, folders }: { patterns: string[]; folders: string[] }, t) => {
      const requests = fakeGitHub(t, files);
      await findGitHubFiles(source, patterns);

      assert.deepEqual(
        requests.map((request) => request.url.replace('https://api.github.com/repos/owner/repo/contents/', '')),
        folders,
      );
    },
  );

  test('lists a file found twice once', async (t) => {
    fakeGitHub(t, files);
    const found = await findGitHubFiles(source, ['img/a.png', 'img/*.png', 'img/*']);

    assert.deepEqual(found, { files: ['img/a.png', 'img/b.svg'], unmatched: [] });
  });

  test('lists the root from the ref', async (t) => {
    const requests = fakeGitHub(t, files);
    await findGitHubFiles({ repo: 'owner/repo', ref: 'v2' }, ['*.md']);

    assert.deepEqual(
      requests.map((request) => request.url),
      ['https://api.github.com/repos/owner/repo/contents/?ref=v2'],
    );
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
        { type: 'file', name: 'a.md', path: 'docs/a.md', download_url: 'https://example.com/a.md' },
        { type: 'symlink', name: 'b.md', path: 'docs/b.md', download_url: 'https://example.com/b.md' },
        // GitHub lists a submodule as a file, with nothing to download.
        { type: 'file', name: 'c.md', path: 'docs/c.md', download_url: null },
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
      assert.equal(error.path, 'missing');
      return true;
    });
  });

  testEach`
    pattern
    ${'/*.md'}
    ${'/img/*.png'}
    ${'img//*.png'}
    ${'./*.md'}
    ${'../*.md'}
    ${'img/../*.md'}
    ${'img/{*,../packages/*}'}
    ${'{*.md,/img/*}'}
  `('refuses $pattern, without a request', async ({ pattern }: { pattern: string }, t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, [pattern]), {
      message:
        'A path must be written from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    });
    assert.deepEqual(requests, []);
  });

  testEach`
    pattern
    ${'**/*.md'}
    ${'img/**'}
    ${'img/**/*.png'}
    ${'img/**.png'}
    ${'img/{**,deeper}/*.png'}
    ${'packages/{*,three/src}*'}
  `('refuses $pattern, without a request for it or another pattern', async ({ pattern }: { pattern: string }, t) => {
    const requests = fakeGitHub(t, files);

    await assert.rejects(findGitHubFiles(source, ['img/*', pattern]), { message: "A pattern can't hold **." });
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
