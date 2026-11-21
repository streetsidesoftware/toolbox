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

/** What a path in a repository holds: a file's content, or a folder's entries. */
export type GitHubPath =
  | { type: 'file'; path: string; content: Uint8Array }
  | {
      type: 'dir';
      path: string;
      entries: { type: 'file' | 'dir' | 'symlink' | 'submodule'; name: string; path: string }[];
    };

/** Nothing usable was found on GitHub, such as no file at a path on that ref. */
export class GitHubError extends Error {
  /** An HTTP status code that says what went wrong, such as 404 when nothing was found at the path. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
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
  const found = await fetchGitHubPath(source, filePath, options);
  // Asked for a file, a folder means no file was found at the path.
  if (found.type !== 'file') throw new GitHubError('The path names a folder, not a file.', 404);
  return found.content;
}

/**
 * Read a path from a GitHub repository: a file's content, or a folder's entries.
 *
 * @param source - The repository, and the ref and token to read it with.
 * @param repoPath - The path from the root of the repository, such as `static/sponsor.md` or `static`.
 * @param options - Options, such as a signal to abort the request.
 * @returns The file or folder at the path.
 *
 * @example
 * const result = await fetchGitHubPath({ repo: 'streetsidesoftware/.github' }, 'static/sponsor.md');
 * if (result.type === 'file') console.log(new TextDecoder().decode(result.content));
 */
export async function fetchGitHubPath(
  source: GitHubSource,
  repoPath: string,
  options: FetchOptions = {},
): Promise<GitHubPath> {
  checkSource(source);
  if (!isRepoPath(repoPath)) {
    throw new Error(
      'A path must be written from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    );
  }

  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${source.repo}/contents/${encodedPath}`);
  if (source.ref) url.searchParams.set('ref', source.ref);

  const headers: Record<string, string> = {
    // A file comes back raw. A folder comes back as a JSON list of its entries, whatever is asked for.
    Accept: 'application/vnd.github.raw+json',
    'User-Agent': 'copy-github-files',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (source.token) headers['Authorization'] = `Bearer ${source.token}`;

  const response = await fetch(url, { headers, signal: options.signal ?? null });
  // The status code only: HTTP/2 responses carry no status text.
  if (!response.ok) throw new GitHubError(`GitHub responded with status ${response.status}`, response.status);
  if (response.headers.get('content-type')?.startsWith('application/vnd.github.raw')) {
    return { type: 'file', path: repoPath, content: await response.bytes() };
  }
  const listing: unknown = await response.json();
  if (!Array.isArray(listing)) throw new Error('The path names neither a file nor a folder.');
  const entries = (listing as { type: 'file' | 'dir' | 'symlink' | 'submodule'; name: string; path: string }[]).map(
    ({ type, name, path }) => ({ type, name, path }),
  );
  return { type: 'dir', path: repoPath, entries };
}

/** Throw when the source can't name a repository, so a request never reaches another part of GitHub's API. */
export function checkSource(source: GitHubSource): void {
  // An owner has no dots, and a repository name is never `.` or `..`.
  if (!/^[\w-]+\/(?!\.\.?$)[\w.-]+$/.test(source.repo)) {
    throw new Error('The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.');
  }
  if (source.ref === '') throw new Error('The ref must name a branch, tag or commit.');
}

function isRepoPath(repoPath: string): boolean {
  return repoPath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
