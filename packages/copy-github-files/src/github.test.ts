import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { fakeGitHub } from './fake-github.ts';
import { fetchGitHubFile, GitHubError } from './github.ts';

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

  test('refuses a folder', async (t) => {
    fakeGitHub(t, {});

    await assert.rejects(fetchGitHubFile({ repo: 'owner/repo' }, 'static'), {
      message: 'The path names a folder, not a file.',
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

  test('refuses a repository not written as owner/repo, without a request', async (t) => {
    const requests = fakeGitHub(t, {});
    for (const repo of [
      'owner',
      'owner/repo/extra',
      'https://github.com/owner/repo',
      '../..',
      'owner/..',
      'own.er/repo',
    ]) {
      await assert.rejects(
        fetchGitHubFile({ repo }, 'a.md'),
        { message: 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.' },
        repo,
      );
    }
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

  test('refuses a path outside the repository, without a request', async (t) => {
    const requests = fakeGitHub(t, {});
    for (const filePath of ['../a.md', '/a.md', 'static/./a.md', 'static//a.md', '']) {
      await assert.rejects(
        fetchGitHubFile({ repo: 'owner/repo' }, filePath),
        {
          message:
            'A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.',
        },
        filePath,
      );
    }
    assert.deepEqual(requests, []);
  });
});
