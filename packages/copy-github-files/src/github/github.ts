/** Where to read files from on GitHub. */
export interface GitHubSource {
  /** The repository, as `owner/repo`, such as `streetsidesoftware/.github`. */
  repo: string;
  /** The branch, tag or commit to read from. Defaults to the repository's default branch. */
  ref?: string | undefined;
  /** A token for GitHub's API. Needed for a private repository, and raises the rate limit. */
  token?: string | undefined;
}

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

/** An error from GitHub, with the HTTP status that says what went wrong. */
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
 * A folder at the path counts as no file there. To read a folder's entries, use {@link fetchGitHubPath}.
 *
 * @param filePath - from the root of the repository, such as `static/sponsor.md`.
 * @example
 * const content = await fetchGitHubFile({ repo: 'streetsidesoftware/.github' }, 'static/sponsor.md');
 * console.log(new TextDecoder().decode(content));
 * // The text of static/sponsor.md
 */
export async function fetchGitHubFile(
  source: GitHubSource,
  filePath: string,
  options?: FetchOptions,
): Promise<Uint8Array> {
  const found = await fetchGitHubPath(source, filePath, options);
  // Asked for a file, a folder means no file was found at the path.
  if (found.type !== 'file') throw new GitHubError('The path names a folder, not a file.', 404);
  return found.content;
}

/**
 * Read a path from a GitHub repository: a file's content, or a folder's entries.
 *
 * To read a path that must be a file, use {@link fetchGitHubFile}.
 *
 * @param repoPath - from the root of the repository, such as `static/sponsor.md` or `static`.
 * @example
 * const found = await fetchGitHubPath({ repo: 'streetsidesoftware/.github' }, 'static');
 * if (found.type === 'dir') console.log(found.entries.map((entry) => entry.path));
 * // The paths of the files and folders in static, such as static/sponsor.md
 */
export async function fetchGitHubPath(
  source: GitHubSource,
  repoPath: string,
  options?: FetchOptions,
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

  const response = await fetch(url, { headers, signal: options?.signal ?? null });
  if (!response.ok) throw new GitHubError(refusal(response, source), response.status);
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

/**
 * Return the message for a refused request: the rate limit when it ran out, or else the status code, since HTTP/2
 * responses carry no status text.
 * The request that uses up the limit is still answered with its own status, so only a 403 or 429 means the limit.
 */
function refusal(response: Response, source: GitHubSource): string {
  const limitStatus = response.status === 403 || response.status === 429;
  if (limitStatus && response.headers.get('x-ratelimit-remaining') === '0') {
    return source.token
      ? "GitHub's rate limit was reached."
      : "GitHub's rate limit was reached. A token raises the limit.";
  }
  return `GitHub responded with status ${response.status}`;
}

function isRepoPath(repoPath: string): boolean {
  return repoPath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
