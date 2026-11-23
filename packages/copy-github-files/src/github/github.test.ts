import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { fakeGitHub } from '../testing/fake-github.ts';
import { fetchGitHubFile, fetchGitHubPath, GitHubError } from './github.ts';

describe('fetchGitHubFile', () => {
  test('reads a file from the default branch, without a token', async (t) => {
    const requests = fakeGitHub(t, { 'static/sponsor.md': '# Sponsor\n' });
    const content = await fetchGitHubFile({ repo: 'owner/repo' }, 'static/sponsor.md');

    assert.deepEqual(content, new TextEncoder().encode('# Sponsor\n'));
    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/static/sponsor.md');
    assert.equal(requests[0]?.headers['Accept'], 'application/vnd.github.raw+json');
    assert.equal(requests[0]?.headers['Authorization'], undefined);
  });

  test('reads from the ref when one is given', async (t) => {
    const requests = fakeGitHub(t, { 'a.md': '' });
    await fetchGitHubFile({ repo: 'owner/repo', ref: 'v1.0' }, 'a.md');

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/a.md?ref=v1.0');
  });

  test('sends the token as a bearer token', async (t) => {
    const requests = fakeGitHub(t, { 'a.md': '' });
    await fetchGitHubFile({ repo: 'owner/repo', token: 'secret' }, 'a.md');

    assert.equal(requests[0]?.headers['Authorization'], 'Bearer secret');
  });

  test('encodes each segment of the path', async (t) => {
    const requests = fakeGitHub(t, { 'my docs/a#b.md': '' });
    await fetchGitHubFile({ repo: 'owner/repo' }, 'my docs/a#b.md');

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/my%20docs/a%23b.md');
  });

  test('gives the status when GitHub refuses the request', async (t) => {
    fakeGitHub(t, {});

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, 'a.md'), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 404);
      assert.equal(error.name, 'GitHubError');
      assert.equal(error.message, 'GitHub responded with status 404');
      return true;
    });
  });

  testEach`
    refusal                                          | status | token        | remaining | message
    ${'the rate limit, without a token'}             | ${403} | ${undefined} | ${'0'}    | ${"GitHub's rate limit was reached. A token raises the limit."}
    ${'the rate limit, with a token'}                | ${403} | ${'secret'}  | ${'0'}    | ${"GitHub's rate limit was reached."}
    ${'the rate limit, as a 429'}                    | ${429} | ${undefined} | ${'0'}    | ${"GitHub's rate limit was reached. A token raises the limit."}
    ${'a 403 with requests left in the limit'}       | ${403} | ${undefined} | ${'12'}   | ${'GitHub responded with status 403'}
    ${'a 404 on the request that used up the limit'} | ${404} | ${undefined} | ${'0'}    | ${'GitHub responded with status 404'}
  `(
    'says when GitHub refuses a request for $refusal',
    async (
      {
        status,
        token,
        remaining,
        message,
      }: { status: number; token: string | undefined; remaining: string; message: string },
      t,
    ) => {
      t.mock.method(
        globalThis,
        'fetch',
        async () => new Response('{}', { status, headers: { 'x-ratelimit-remaining': remaining } }),
      );

      await assert.rejects(fetchGitHubFile({ repo: 'owner/repo', token }, 'a.md'), (error) => {
        assert.ok(error instanceof GitHubError);
        assert.equal(error.status, status);
        assert.equal(error.message, message);
        return true;
      });
    },
  );

  test('finds no file at a folder', async (t) => {
    fakeGitHub(t, { 'static/a.md': '' });

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, 'static'), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'The path names a folder, not a file.');
      return true;
    });
  });

  test('passes the error on when the body fails to arrive', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.error(new Error('connection reset'));
        },
      });
      return new Response(body, { headers: { 'content-type': 'application/vnd.github.raw+json' } });
    });

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, 'a.md'), { message: 'connection reset' });
  });

  test('passes the signal to the request', async (t) => {
    const requests = fakeGitHub(t, { 'a.md': '' });
    const controller = new AbortController();
    await fetchGitHubFile({ repo: 'owner/repo' }, 'a.md', { signal: controller.signal });

    assert.equal(requests[0]?.signal, controller.signal);
  });

  test('stops when the signal is aborted', async (t) => {
    fakeGitHub(t, { 'a.md': '' });

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, 'a.md', { signal: AbortSignal.abort() }), {
      name: 'AbortError',
    });
  });

  testEach`
    repo
    ${'owner'}
    ${'owner/repo/extra'}
    ${'https://github.com/owner/repo'}
    ${'../..'}
    ${'owner/..'}
    ${'own.er/repo'}
  `('refuses the repository $repo, without a request', async ({ repo }: { repo: string }, t) => {
    const requests = fakeGitHub(t, {});

    await assert.rejects(fetchGitHubFile({ repo }, 'a.md'), {
      message: 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
    });
    assert.deepEqual(requests, []);
  });

  test('accepts a repository name with dots', async (t) => {
    const requests = fakeGitHub(t, { 'a.md': '' });
    await fetchGitHubFile({ repo: 'owner/.github' }, 'a.md');

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/.github/contents/a.md');
  });

  test('refuses an empty ref, without a request', async (t) => {
    const requests = fakeGitHub(t, {});

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo', ref: '' }, 'a.md'), {
      message: 'The ref must name a branch, tag or commit.',
    });
    assert.deepEqual(requests, []);
  });

  testEach`
    filePath
    ${'../a.md'}
    ${'/a.md'}
    ${'static/./a.md'}
    ${'static//a.md'}
    ${''}
  `('refuses the path $filePath, without a request', async ({ filePath }: { filePath: string }, t) => {
    const requests = fakeGitHub(t, {});

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, filePath), {
      message:
        'A path must be written from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    });
    assert.deepEqual(requests, []);
  });
});

describe('fetchGitHubPath', () => {
  test('gives a file with its content', async (t) => {
    fakeGitHub(t, { 'static/sponsor.md': '# Sponsor\n' });
    const found = await fetchGitHubPath({ repo: 'owner/repo' }, 'static/sponsor.md');

    assert.deepEqual(found, {
      type: 'file',
      path: 'static/sponsor.md',
      content: new TextEncoder().encode('# Sponsor\n'),
    });
  });

  test('gives a folder with its entries', async (t) => {
    fakeGitHub(t, { 'static/sponsor.md': '', 'static/images/logo.svg': '' });
    const found = await fetchGitHubPath({ repo: 'owner/repo' }, 'static');

    assert.deepEqual(found, {
      type: 'dir',
      path: 'static',
      entries: [
        { type: 'file', name: 'sponsor.md', path: 'static/sponsor.md' },
        { type: 'dir', name: 'images', path: 'static/images' },
      ],
    });
  });

  test('gives the status when nothing is at the path', async (t) => {
    fakeGitHub(t, {});

    await assert.rejects(fetchGitHubPath({ repo: 'owner/repo' }, 'missing.md'), (error) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'GitHub responded with status 404');
      return true;
    });
  });

  test('refuses an answer that is neither a file nor a folder', async (t) => {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('{"type":"submodule"}', { headers: { 'content-type': 'application/json' } }),
    );

    await assert.rejects(fetchGitHubPath({ repo: 'owner/repo' }, 'vendor'), {
      message: 'The path names neither a file nor a folder.',
    });
  });
});
