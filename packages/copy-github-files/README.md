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

Run it again to bring the copies up to date. Every file is written each time, and git shows which ones changed.

To run it from a script in `package.json`:

```json
{
  "scripts": {
    "copy:static": "copy-github-files streetsidesoftware/.github static/sponsor.md static/footer.md"
  }
}
```

### Options

| Option           | What it does                                                                            |
| ---------------- | --------------------------------------------------------------------------------------- |
| `--output <dir>` | Write the files below `<dir>` instead of the current folder, keeping their paths.       |
| `--ref <ref>`    | Copy from a branch, tag or commit. Without it, the repository's default branch is used. |
| `--help`         | Show the usage.                                                                         |

With `--output docs`, `static/sponsor.md` is written to `docs/static/sponsor.md`.

### Authentication

A public repository needs no token. When `GITHUB_TOKEN` is set, it authenticates the requests:

- It raises GitHub's limit of 60 unauthenticated requests an hour. Each file is one request.
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
copied. The command says which file failed and why, and exits with code 1.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

## License

<!-- @@inject: ../../static/licenseTpl.md#values-file=:package.json -->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->
