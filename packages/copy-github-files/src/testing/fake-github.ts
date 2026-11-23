import type { TestContext } from 'node:test';

/** A request the fake received. */
export interface FakeRequest {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal | null | undefined;
}

/**
 * Replace the global `fetch` for one test with a fake of GitHub's contents API for `owner/repo`.
 * A path in `files` gives its content, a folder of those paths gives its listing, and any other path gives a 404.
 */
export function fakeGitHub(t: TestContext, files: Record<string, string>): FakeRequest[] {
  const requests: FakeRequest[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, headers: (init?.headers ?? {}) as Record<string, string>, signal: init?.signal });
    init?.signal?.throwIfAborted();
    const filePath = decodeURIComponent(url.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    const content = files[filePath];
    if (content !== undefined) {
      return new Response(content, { headers: { 'content-type': 'application/vnd.github.raw+json; charset=utf-8' } });
    }
    const entries = listFolder(files, filePath);
    if (entries.length) {
      return new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    // No status text: HTTP/2 responses from GitHub carry none.
    return new Response('{}', { status: 404 });
  });
  return requests;
}

/** The entries directly in a folder, in the form GitHub lists them, or none when no file is below it. */
function listFolder(files: Record<string, string>, folder: string) {
  const entries = new Map<string, { type: 'file' | 'dir'; name: string; path: string; sha: string }>();
  for (const filePath of Object.keys(files)) {
    if (!filePath.startsWith(`${folder}/`)) continue;
    const [name = '', ...rest] = filePath.slice(folder.length + 1).split('/');
    entries.set(name, { type: rest.length ? 'dir' : 'file', name, path: `${folder}/${name}`, sha: '0' });
  }
  return [...entries.values()];
}
