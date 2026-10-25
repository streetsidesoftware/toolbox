# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install
pnpm run build       # pnpm -r run build     — tsdown, per package
pnpm run typecheck   # pnpm -r run typecheck — tsc --noEmit, per package
pnpm test            # pnpm -r run test      — node --test, per package, then typecheck
pnpm run lint
pnpm run lint-ci     # read-only, what CI runs
pnpm run clean
```

Run a single test file or test case with Node directly from inside a package:

```sh
cd packages/unindent
node --test src/unindent.test.ts
node --test --test-name-pattern='same line' src/unindent.test.ts
```

Once you're done making changes, run `pnpm run lint` from the repo root — it auto-fixes what it can — before a
final `pnpm run lint-ci`/`pnpm test` pass.

## Pull requests

After pushing more commits to an already-open PR, re-check that its body still matches — see CONTRIBUTING.md's
"Commits & pull requests" section for what the body should contain.

## Code style

Use explicit escape sequences (e.g. ` `, `\t`) rather than literal invisible/non-printing characters in
source code, including inside string and regex literals.

Keep comments short. A comment covers the "what" and, only when it's non-obvious, a bit of the "why". Favor one
line over a `/** ... */` block. Don't restate what well-named identifiers already say. Keep a single comment
line to 140 characters or fewer.

Tests use `node:test` and `node:assert/strict`. Don't add vitest, jest, or another test framework.

Only erasable TypeScript syntax: Node runs the `.ts` sources directly by stripping types. No `enum`,
`namespace`, or parameter properties; use `import type` for types.

## Architecture

A pnpm workspace monorepo. See `docs/build-and-packaging.md` before changing build config or dependencies.

- `packages/*` — published to npm as `@streetsidesoftware/<name>`. Only packages meant for npm go here; a new one
  stays private until a maintainer publishes it.
  `packages/unindent` is the template for a new package.
- `internal/*` — private `@internal/*` packages used only by this repo. Never published or bundled into a
  published package.
- `scripts/` — `@internal/scripts`: `fix-package-json` (run by `pnpm run lint`) and the release scripts
  (`update-release-please-config`, `release-as`, `publication-candidates`, `prepare-publication`,
  `trusted-publishing`), which are not lint.

Every published `src/*.ts` entry needs a matching entry in **both** `tsdown.config.ts`'s `entry` and
`package.json`'s `exports`; tsdown does not infer one from the other.

**Dependency licenses** — every package is MIT. Before adding a dependency, bundling one, or copying code or
data in, check its license by `docs/dependency-licenses.md`. If it would force a package's license to change,
stop and tell the user exactly which dependency, which license, and what would have to change.

**Release and publish flow** — see `docs/releasing.md`. Never edit `release-please-config.json` or
`.release-please-manifest.json` by hand: the Update Release Please Config workflow maintains both on `main`. Keep
release tooling out of `lint` and `lint-ci`. A new package starts `private: true` at `0.0.1-alpha.0`, with
" -- Private until verified" at the end of its `description`; only a maintainer makes it public (see "New packages").
Publishing uses npm Trusted Publishing only; there is no npm token.

`static/published.json` holds each package's publication state, one line per package. The Prepare a New Package for
Publication workflow opens a publication PR for every private package on `main` without an open PR, unless its entry is
`false`. Don't add entries by hand, except `false` for a package never to publish.

A package's `README.md` is rendered on npmjs.com on its own, so every link in it must be an absolute `https://`
URL. Write it for someone installing and using the package, not for a contributor.

Every package README ends with the sponsor section (`static/sponsor.md`) and the footer (`static/footer.md`),
injected with `inject-markdown` markers. Edit the files in `static/`, not the injected copies, and run
`pnpm run build:readme` to update every README. Keep `static/sponsor-pub.md` in step with `static/sponsor.md`:
it's the Markdown-only version `publish.yml` swaps in for npm, since npmjs.com doesn't render HTML like `<picture>`.

The root `README.md` packages table is generated from every `packages/*/package.json`, private ones included (name
and `description`), into `static/packages.csv` by `gen-readme`, and injected. Change the `description`, not the table.
The Update READMEs workflow runs `pnpm run build:readme` on `main` and opens a PR with any change, so running it
locally is optional. See [releasing](docs/releasing.md#new-packages) for what `private` means here.

In `README.md` and other user-facing text, don't start a sentence with a code span; lead with a word instead.
List items can start with code.

Guides and other docs for people never point to `CLAUDE.md`. If a guide needs something that's only here, move
it into its own doc under `docs/` and link to that from both.

Dependency updates are handled by Dependabot (`.github/dependabot.yml`) — dev and production dependencies are
grouped into separate PRs, as are GitHub Actions version bumps.
