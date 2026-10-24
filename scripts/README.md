# Repo Scripts

These scripts are used to help maintain the repo.

## Lint

- `fix-package-json.ts` lints and fixes `packages/*/package.json` and `internal/*/package.json`: `repository`,
  `publishConfig`, `keywords`, and field order. `pnpm run lint` runs it in fixing mode; `pnpm run lint-ci` runs it
  with `--dry-run`, which exits with a non-zero status if a file needs fixing.

## READMEs

- `gen-readme.ts` writes `static/packages.csv`, the table of published (non-private) `packages/*` packages that the
  root `README.md` injects. `pnpm run build:readme` runs it, then `inject-markdown` and Prettier on every README.
  `pnpm run readme:check` (`gen-readme --check`, part of `lint-ci`) exits with a non-zero status if
  `build:readme` would change the CSV or any README.

## Release

See [releasing](../docs/releasing.md). None of these run as part of lint.

- `update-release-please-config.ts` (`pnpm run release-please-config`) updates `release-please-config.json` and
  `.release-please-manifest.json`. The Update Release Please Config workflow runs it on `main`. `--check` exits with
  a non-zero status if either file is out of date.
- `release-as.ts` (`pnpm run release-as`) sets or removes a package's `release-as`.
- `prepare-publication.ts` (`pnpm run prepare-publication`) makes a private package public and sets its `release-as`
  to `1.0.0`. The Prepare a New Package for Publication workflow runs it.
- `trusted-publishing.ts` (`pnpm run trusted-publishing`) adds, checks, or locks down each package's npm trusted
  publisher, and records it in `static/published.json`. A maintainer runs it by hand.

Run any of them with `--help` for the options.

Tests for `lib/` run with `pnpm test` from the repo root, or `node --test "lib/**/*.test.ts"` from here.
