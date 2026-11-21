/** Where and how to read files from GitHub. */
export interface GitHubSource {
  /** The repository, as `owner/repo`. */
  repo: string;
  /** The branch, tag or commit. The repository's default branch when not set. */
  ref: string | undefined;
  /** Sent as a bearer token when set. */
  token: string | undefined;
  fetch: typeof globalThis.fetch;
}

export type FetchResult = { ok: true; content: Uint8Array } | { ok: false; reason: string };

/**
 * Read one file through GitHub's contents API.
 * A request that fails, or a path that isn't a file, gives `ok: false` instead of throwing.
 */
export async function fetchFile(source: GitHubSource, filePath: string): Promise<FetchResult> {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${source.repo}/contents/${encodedPath}`);
  if (source.ref) url.searchParams.set('ref', source.ref);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
    'User-Agent': 'copy-github-files',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (source.token) headers['Authorization'] = `Bearer ${source.token}`;

  try {
    const response = await source.fetch(url, { headers });
    // The status code only: HTTP/2 responses carry no status text.
    if (!response.ok) return { ok: false, reason: `GitHub responded with status ${response.status}` };
    // GitHub sends a folder's listing as JSON, even when the raw form is asked for.
    if (!response.headers.get('content-type')?.startsWith('application/vnd.github.raw')) {
      return { ok: false, reason: 'it is not a file' };
    }
    return { ok: true, content: new Uint8Array(await response.arrayBuffer()) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
