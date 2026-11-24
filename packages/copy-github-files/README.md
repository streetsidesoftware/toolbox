# @streetsidesoftware/copy-github-files

Copy files from a GitHub repository into your own, such as a shared `sponsor.md` that several repositories include.

## Install

```sh
npm install --save-dev @streetsidesoftware/copy-github-files
```

## Usage

Name the repository and the files to copy:

```sh
copy-github-files streetsidesoftware/.github static/sponsor.md static/footer.md
```

Each file keeps its path from the root of the repository, so `static/sponsor.md` is written to `static/sponsor.md` in
the current folder. The command lists each file it copied:

```text
Copied static/sponsor.md
Copied static/footer.md
```

Run it again to bring the copies up to date. Every file is written each time, and git shows which ones changed. With
`--silent`, the command lists no copied files, and shows only failures.

To run it from a script in `package.json`:

```json
{
  "scripts": {
    "copy:static": "copy-github-files streetsidesoftware/.github static/sponsor.md static/footer.md"
  }
}
```

### Patterns

To copy files without naming each one, use a pattern:

```sh
copy-github-files streetsidesoftware/.github 'static/*.md'
```

| To copy                                        | Use                      |
| ---------------------------------------------- | ------------------------ |
| The Markdown files in a folder                 | `'static/*.md'`          |
| The Markdown files in the root folder          | `'*.md'`                 |
| Every file in a folder, but not its subfolders | `'images/*'`             |
| The PNG and SVG files in a folder              | `'images/*.{png,svg}'`   |
| The README of each package                     | `'packages/*/README.md'` |

Quote a pattern, so the shell doesn't expand it against your own files.

A pattern doesn't support `**`. To copy dotfiles, write the dot, as in `'images/.*'`.

Any path with `*`, `?`, `[` or `{` in it is a pattern, with the syntax of Node's
[`path.matchesGlob`](https://nodejs.org/api/path.html#pathmatchesglobpath-pattern).

If a pattern matches no file, the command says so after copying, as `No file matches <pattern>`, and exits with code 1.

### Excluding files

To skip some of the files a pattern matches, use `--exclude`:

```sh
copy-github-files streetsidesoftware/.github 'static/*.md' --exclude footer.md
```

| To skip                        | Use                                       |
| ------------------------------ | ----------------------------------------- |
| A file, in any folder          | `--exclude footer.md`                     |
| One file                       | `--exclude static/footer.md`              |
| All SVG files                  | `--exclude '*.svg'`                       |
| A folder and everything in it  | `--exclude drafts/`                       |
| All SVG files below one folder | `--exclude 'static/**/*.svg'`             |
| All SVG files except the logo  | `--exclude '*.svg' --exclude '!logo.svg'` |

Repeat `--exclude` to skip more. The globs work like the lines of a `.gitignore` file, except that a `!` glob always
wins, whatever its place in the list. It can't keep a file in a folder that is skipped.

A path given in full is always copied, even when an exclude matches it.

### Options

| Option              | What it does                                                                            |
| ------------------- | --------------------------------------------------------------------------------------- |
| `--output <dir>`    | Write the files below `<dir>` instead of the current folder, keeping their paths.       |
| `--ref <ref>`       | Copy from a branch, tag or commit. Without it, the repository's default branch is used. |
| `--exclude <glob>`  | Skip the files a pattern matches that `<glob>` matches. Repeat it for more globs.       |
| `--concurrency <n>` | Download up to `<n>` files at once. Default: 8.                                         |
| `--fail-fast`       | Stop at the first file that fails.                                                      |
| `--silent`          | List no copied files. Failures are still shown.                                         |
| `--help`            | Show the usage.                                                                         |

With `--output docs`, `static/sponsor.md` is written to `docs/static/sponsor.md`.

### Authentication

A public repository needs no token. When `GITHUB_TOKEN` is set, it authenticates the requests:

- It raises GitHub's limit of 60 unauthenticated requests an hour. Each file is one request, and so is each folder a pattern looks in.
- It gives access to a private repository, when the token can read that repository.

In a GitHub workflow, pass the workflow's token to copy from a public repository:

```yaml
- run: npm run copy:static
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The workflow's token can read only the repository the workflow runs in. To copy from another private repository, use
a token with read access to it, such as a fine-grained personal access token or a GitHub App token.

### When a file can't be copied

Each file is copied on its own. If one fails, such as a path that doesn't exist on that branch, the others are still
copied. The command says which file failed and why, and exits with code 1. With `--fail-fast`, it stops at the first
file that fails.

A pattern is different: if a folder it looks in can't be listed, such as one that doesn't exist, the command shows
the error, copies nothing, and exits with code 1.

GitHub lists at most 1,000 entries of a folder, so a pattern doesn't see the rest of a larger folder.

## Library

The same copy is available from code:

```ts
import { copyGitHubFiles } from '@streetsidesoftware/copy-github-files';

const source = { repo: 'streetsidesoftware/.github' };
for await (const result of copyGitHubFiles(source, ['static/sponsor.md', 'static/footer.md'], '.')) {
  if ('error' in result) console.error(`Failed to copy ${result.path}: ${result.error.message}`);
  else console.log(`Copied ${result.file}`);
}
```

It downloads up to 8 files at once, and gives each file's result as soon as that file is written or fails, so results
can come in any order. A failed file doesn't stop the others.

To stop early, break out of the loop, or pass a signal and abort it. Downloads still running are stopped, and only the
files already given as results are written. An aborted signal ends the loop by throwing its reason, such as the
`TimeoutError` of `AbortSignal.timeout()`:

```ts
const results = copyGitHubFiles(source, paths, '.', { signal: AbortSignal.timeout(30_000) });
```

To change how many files download at once, pass `concurrency`:

```ts
const results = copyGitHubFiles(source, paths, '.', { concurrency: 2 });
```

The source also takes a `ref`, and a `token` for a private repository.

To copy the files that patterns match, find them with `findGitHubFiles` first, and pass the files it finds to
`copyGitHubFiles`:

```ts
import { copyGitHubFiles, findGitHubFiles } from '@streetsidesoftware/copy-github-files';

const source = { repo: 'streetsidesoftware/.github' };
const found = await findGitHubFiles(source, ['static/*.md'], { exclude: ['footer.md'] });
for (const pattern of found.unmatched) console.error(`No file matches ${pattern}`);
for await (const result of copyGitHubFiles(source, found.files, '.')) {
  if ('error' in result) console.error(`Failed to copy ${result.path}: ${result.error.message}`);
  else console.log(`Copied ${result.file}`);
}
```

It keeps each path given in full as it is. It lists a file found twice once, and gives in `unmatched` each pattern
that matched no file. If a folder a pattern looks in can't be listed, it rejects with that folder's error.

To read one file without writing it, use `fetchGitHubFile`:

```ts
import { fetchGitHubFile } from '@streetsidesoftware/copy-github-files';

const content = await fetchGitHubFile({ repo: 'streetsidesoftware/.github' }, 'static/sponsor.md');
```

To see what's at a path, a file or a folder, use `fetchGitHubPath`:

```ts
import { fetchGitHubPath } from '@streetsidesoftware/copy-github-files';

const found = await fetchGitHubPath({ repo: 'streetsidesoftware/.github' }, 'static');
if (found.type === 'dir') {
  for (const entry of found.entries) console.log(`${entry.type} ${entry.path}`);
} else {
  console.log(`${found.path} is a file of ${found.content.length} bytes.`);
}
```

An error from GitHub is a `GitHubError`. Its `repo`, `ref` and `path` are what was asked for, and its `status` says what
went wrong, such as 404 when the repository, ref or path wasn't found. Asked for a file, `fetchGitHubFile` also gives
404 for a folder, since no file is there. A failed result from `copyGitHubFiles` carries the same error:

```ts
import { GitHubError } from '@streetsidesoftware/copy-github-files';

if ('error' in result && result.error instanceof GitHubError && result.error.status === 404) {
  console.warn(`No file at ${result.path} on that branch.`);
}
```

## Requirements

<!--- @@inject: ../../static/requirements.md#values-file=:package.json --->

Requires Node.js >=22.18.0. ESM only.

<!--- @@inject-end: ../../static/requirements.md#values-file=:package.json --->

## License

<!--- @@inject: ../../static/licenseTpl.md#values-file=:package.json --->

MIT

<!--- @@inject-end: ../../static/licenseTpl.md#values-file=:package.json --->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

If our tools save you time, please consider supporting their development.

Please show your support through one of the following sites:

<p align="left">
  <a href="https://github.com/sponsors/streetsidesoftware" title="GitHub Sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/github-sponsor-dark.png" /><img alt="GitHub Sponsor" src="https://streetsidesoftware.com/img/sponsor/github-sponsor.png" width="180" /></picture></a> &nbsp; <a href="https://www.paypal.com/donate/?hosted_button_id=26LNBP2Q6MKCY" title="PayPal"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/paypal-dark.png" /><img alt="PayPal" src="https://streetsidesoftware.com/img/sponsor/paypal.png" width="180" /></picture></a> &nbsp; <a href="https://opencollective.com/cspell" title="Open Collective"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/open-collective-dark.png" /><img alt="Open Collective" src="https://streetsidesoftware.com/img/sponsor/open-collective.png" width="180" /></picture></a> &nbsp; <a href="https://streetsidesoftware.com/sponsor/" title="Street Side Software"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/cspell-dark.png" /><img alt="CSpell" src="https://streetsidesoftware.com/img/sponsor/cspell.png" width="180" /></picture></a>
</p>

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: ../../static/footer.md --->
