/** Where to read files from on GitHub. */
export interface GitHubSource {
  /** The repository, as `owner/repo`, such as `streetsidesoftware/.github`. */
  repo: string;
  /** The branch, tag or commit to read from. Defaults to the repository's default branch. */
  ref?: string | undefined;
  /** A token for GitHub's API. Needed for a private repository, and raises the rate limit. */
  token?: string | undefined;
}

/** Options for reading from GitHub. */
export interface FetchOptions {
  /** Stops the request when aborted. */
  signal?: AbortSignal | undefined;
}

/**
 * Read one file from a GitHub repository.
 *
 * @param source - The repository, and the ref and token to read it with.
 * @param filePath - The file's path from the root of the repository, such as `static/sponsor.md`.
 * @param options - Options, such as a signal to abort the request.
 * @returns The file's content.
 */
export async function fetchGitHubFile(
  source: GitHubSource,
  filePath: string,
  options: FetchOptions = {},
): Promise<Uint8Array> {
  checkSource(source);
  if (!isRepoPath(filePath)) {
    throw new Error(
      'A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    );
  }

  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${source.repo}/contents/${encodedPath}`);
  if (source.ref) url.searchParams.set('ref', source.ref);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
    'User-Agent': 'copy-github-files',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (source.token) headers['Authorization'] = `Bearer ${source.token}`;

  const response = await fetch(url, { headers, signal: options.signal ?? null });
  // The status code only: HTTP/2 responses carry no status text.
  if (!response.ok) throw new Error(`GitHub responded with status ${response.status}`);
  // GitHub sends a folder's listing as JSON, even when the raw form is asked for.
  if (!response.headers.get('content-type')?.startsWith('application/vnd.github.raw')) {
    throw new Error('The path names a folder, not a file.');
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Throw when the source can't name a repository, so a request never reaches another part of GitHub's API. */
export function checkSource(source: GitHubSource): void {
  // An owner has no dots, and a repository name is never `.` or `..`.
  if (!/^[\w-]+\/(?!\.\.?$)[\w.-]+$/.test(source.repo)) {
    throw new Error('The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.');
  }
  if (source.ref === '') throw new Error('The ref must name a branch, tag or commit.');
}

function isRepoPath(filePath: string): boolean {
  return filePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
