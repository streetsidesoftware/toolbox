# Repo Scripts

These scripts are used to help maintain the repo.

## Lint

- `fix-package-json.ts` lints and fixes `packages/*/package.json` and `internal/*/package.json`: `repository`,
  `publishConfig`, `keywords`, and field order. `pnpm run lint` runs it in fixing mode; `pnpm run lint-ci` runs it
  with `--dry-run`, which exits with a non-zero status if a file needs fixing.

## New packages

- `new-package.ts` (`pnpm run new-package <name>`) creates `packages/<name>/`, a private package at
  `0.0.1-alpha.0` with a placeholder `src/`, test and `README.md`. See [releasing](../docs/releasing.md#new-packages).
  It copies the files in [`static/templates/`](../static/templates), filling in `{@ name @}`, `{@ fullName @}`
  and `{@ description @}` in their paths and text with `@streetsidesoftware/placeholders`, and copies the root
  `LICENSE`. The templates sit two levels below the root, like `packages/<name>/`, so their relative paths resolve
  and they stay valid files. A placeholder the script has no value for fails the run.

## READMEs

- `gen-readme.ts` writes `static/packages.csv`, the table of every `packages/*` package that the root `README.md`
  injects. `pnpm run build:readme` runs it, then `gen-api-reference` and `run-examples`, then `inject-markdown`
  twice and Prettier on every README. inject-markdown doesn't order files by what they inject
  ([inject-markdown#930](https://github.com/streetsidesoftware/inject-markdown/issues/930)), so the second run picks
  up READMEs the first one changed. A change three levels deep can still need another run, which the workflow makes.
  The Update READMEs workflow runs `build:readme` on `main` and opens a PR with any change.
- `gen-api-reference.ts` writes `static/api-reference/<name>.md`, the function reference of each `packages/<name>`
  whose `README.md` injects it with `<!--- @@inject: ../../static/api-reference/<name>.md --->`. It reads
  `src/index.ts` with [oxc-parser](https://www.npmjs.com/package/oxc-parser), follows its re-exports, and lists
  each exported function with its parameter names, its aliases and its summary, grouped by the function's
  `@category` tag. The summary is the JSDoc's first paragraph, or its `@summary` tag, at most 140 characters and with no raw HTML. A
  function without a `@category` or a summary fails the run. It renders the list with markdown-toolkit, so build it
  first.
- `run-examples.ts` runs each `example.ts` under `packages/*/examples/`, at any depth, with Node, in its own folder and
  without a shell, and writes what it prints to `output.md` next to it. An example's `README.md` injects both. A
  part's `README.md` one level up injects its examples' READMEs, and the package README injects the part's. The
  examples import their package by name, so build it first.

## Release

See [releasing](../docs/releasing.md). None of these run as part of lint.

- `update-release-please-config.ts` (`pnpm run release-please-config`) updates `release-please-config.json` and
  `.release-please-manifest.json`, and drops the entries of packages that no longer exist from
  `static/published.json`. The Update Release Please Config workflow runs it on `main`. `--check` exits with a
  non-zero status if any of the files is out of date.
- `release-as.ts` (`pnpm run release-as`) sets or removes a package's `release-as`.
- `publication-candidates.ts` prints, as JSON, the private packages to open a publication PR for: every one that
  `static/published.json` doesn't mark `false` and whose PR isn't open. It asks the GitHub API for open PRs, with `GITHUB_TOKEN` if set. The Prepare a
  New Package for Publication workflow runs it.
- `prepare-publication.ts` (`pnpm run prepare-publication`) makes a private package public, sets its `release-as`
  to `1.0.0`, and records it in `static/published.json` as waiting for publication. The same workflow runs it.
- `trusted-publishing.ts` (`pnpm run trusted-publishing`) adds, checks, or locks down each package's npm trusted
  publisher, and records it in `static/published.json`. A maintainer runs it by hand.

Run any of them with `--help` for the options.

Tests for `lib/` run with `pnpm test` from the repo root, or `node --test "lib/**/*.test.ts"` from here.
