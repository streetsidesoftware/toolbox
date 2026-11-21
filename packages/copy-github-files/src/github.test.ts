import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { fetchFile } from './github.ts';

describe('fetchFile', () => {
  test('reads a file from the default branch, without a token', async () => {
    const { fetch, requests } = fakeFetch(() => rawResponse('# Sponsor\n'));
    const result = await fetchFile(
      { repo: 'owner/repo', ref: undefined, token: undefined, fetch },
      'static/sponsor.md',
    );

    assert.deepEqual(result, { ok: true, content: new TextEncoder().encode('# Sponsor\n') });
    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/static/sponsor.md');
    assert.equal(requests[0]?.headers['Accept'], 'application/vnd.github.raw+json');
    assert.equal(requests[0]?.headers['Authorization'], undefined);
  });

  test('reads from the ref when one is given', async () => {
    const { fetch, requests } = fakeFetch(() => rawResponse(''));
    await fetchFile({ repo: 'owner/repo', ref: 'v1.0', token: undefined, fetch }, 'a.md');

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/a.md?ref=v1.0');
  });

  test('sends the token as a bearer token', async () => {
    const { fetch, requests } = fakeFetch(() => rawResponse(''));
    await fetchFile({ repo: 'owner/repo', ref: undefined, token: 'secret', fetch }, 'a.md');

    assert.equal(requests[0]?.headers['Authorization'], 'Bearer secret');
  });

  test('encodes each segment of the path', async () => {
    const { fetch, requests } = fakeFetch(() => rawResponse(''));
    await fetchFile({ repo: 'owner/repo', ref: undefined, token: undefined, fetch }, 'my docs/a#b.md');

    assert.equal(requests[0]?.url, 'https://api.github.com/repos/owner/repo/contents/my%20docs/a%23b.md');
  });

  test('gives the status when GitHub refuses the request', async () => {
    const { fetch } = fakeFetch(() => new Response('{}', { status: 404 }));
    const result = await fetchFile({ repo: 'owner/repo', ref: undefined, token: undefined, fetch }, 'a.md');

    assert.deepEqual(result, { ok: false, reason: 'GitHub responded with status 404' });
  });

  test('refuses a folder', async () => {
    const { fetch } = fakeFetch(
      () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } }),
    );
    const result = await fetchFile({ repo: 'owner/repo', ref: undefined, token: undefined, fetch }, 'static');

    assert.deepEqual(result, { ok: false, reason: 'it is not a file' });
  });

  test('gives the error when the body fails to arrive', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const { fetch } = fakeFetch(
      () => new Response(body, { headers: { 'content-type': 'application/vnd.github.raw+json' } }),
    );
    const result = await fetchFile({ repo: 'owner/repo', ref: undefined, token: undefined, fetch }, 'a.md');

    assert.deepEqual(result, { ok: false, reason: 'connection reset' });
  });

  test('gives the error when the request fails', async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const result = await fetchFile({ repo: 'owner/repo', ref: undefined, token: undefined, fetch }, 'a.md');

    assert.deepEqual(result, { ok: false, reason: 'fetch failed' });
  });
});

function rawResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/vnd.github.raw+json; charset=utf-8' },
  });
}

function fakeFetch(respond: () => Response) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return respond();
  };
  return { fetch, requests };
}
