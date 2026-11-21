import type { TestContext } from 'node:test';

/** A request the fake received. */
export interface FakeRequest {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal | null | undefined;
}

/**
 * Replace the global `fetch` for one test with a fake of GitHub's contents API for `owner/repo`.
 * A path in `files` gives its content, `static` gives a folder listing, and any other path gives a 404.
 */
export function fakeGitHub(t: TestContext, files: Record<string, string>): FakeRequest[] {
  const requests: FakeRequest[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, headers: (init?.headers ?? {}) as Record<string, string>, signal: init?.signal });
    init?.signal?.throwIfAborted();
    const filePath = decodeURIComponent(url.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    if (filePath === 'static') {
      return new Response('[]', { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    const content = files[filePath];
    // No status text: HTTP/2 responses from GitHub carry none.
    if (content === undefined) return new Response('{}', { status: 404 });
    return new Response(content, { headers: { 'content-type': 'application/vnd.github.raw+json; charset=utf-8' } });
  });
  return requests;
}
