# Contributing

Thanks for considering a contribution to toolbox.

## TL;DR

This repo holds small tools and libraries shared across Street Side Software's repositories. Each package under
`packages/` is published to npm as `@streetsidesoftware/<name>`.

- **Set up:** `pnpm install`, then `pnpm run build` and `pnpm test`.
- **Add a package:** follow "Publishing a new package" in [releasing](docs/releasing.md).
- **Before a PR:** `pnpm run build`, `pnpm run typecheck`, `pnpm run lint` (auto-fixes), `pnpm test`. CI runs
  `build`, `typecheck`, and `test`, plus `pnpm run lint-ci` (a read-only lint) in a separate workflow.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/). Use `feat:` only for a new
  capability, and `fix:` for any other change to a published package's behavior. A change with no behavior
  change is `refactor:`, and everything else is `chore:`, `docs:`, etc.
- **PR descriptions:** short, with a `## Summary` that stands on its own.

The rest of this file is the full reference, written mainly for coding agents.

<details>
<summary>Details for Agents</summary>

## Workspace layout

- `packages/*` — published packages, one per directory. `packages/unindent` is the template for a new one.
- `internal/*` — private `@internal/*` packages used only inside this repo. Never published.
- `scripts/` — `@internal/scripts`, the repo maintenance CLIs (`fix-package-json`, `fix-release-please-config`).

See [build and packaging](docs/build-and-packaging.md) for the toolchain (tsdown, `tsc --noEmit`, `node --test`).

## Getting started

```sh
pnpm install
pnpm run build       # pnpm -r run build     — tsdown, per package
pnpm run typecheck   # pnpm -r run typecheck — tsc --noEmit, per package
pnpm test            # pnpm -r run test      — node --test, per package, then typecheck
pnpm run lint        # fix-* scripts + eslint --fix + prettier --write
pnpm run lint-ci     # read-only lint, what CI runs
pnpm run smoke-test  # quick PR health check
pnpm run clean       # pnpm -r run clean
```

To scope to one package, `cd` into it and run the command there. Run one test file or test by name with Node
directly:

```sh
cd packages/unindent
node --test src/unindent.test.ts
node --test --test-name-pattern='same line' src/unindent.test.ts
```

## Before submitting a pull request

```sh
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm test
```

All of the above run in CI and must pass.

## Commits & pull requests

Keep commits focused and describe the _why_ in the commit message, not just the _what_.

Follow [Conventional Commits](https://www.conventionalcommits.org/). Release Please derives the version bump
and changelog from the type, so pick it by user-facing impact, not by how much code changed:

- `feat:` — a new capability: something a user of a published package can do that they couldn't before, such
  as a new function, option, or package. A new export counts only if it gives users something they
  couldn't already reach. An export added only to match the other packages is `refactor:`.
- `fix:` — any other change to a published package's behavior: a bug fix, a changed default or output, a
  rename, a removal, or a move to a new API that users would notice.
- `feat!:` / `fix!:` — either of the above, but breaking. Removing or renaming something users rely on is
  `fix!:`, not `feat!:`, unless the same change also adds a new capability.
- `perf:` — a performance improvement a consumer would notice, with no behavior change.
- `revert:` — undoes a previously merged commit. Visible in the changelog under its own "Reverts" section, so
  consumers can see a shipped `feat:`/`fix:` got undone.
- `refactor:` — internal restructuring with no behavior change.
- `docs:` — documentation only (README, ADRs, CONTRIBUTING.md, etc.).
- `style:` — formatting-only changes with no logic difference (e.g. rewrapping a comment, fixing whitespace).
- `test:` — test-only changes.
- `ci:` — GitHub Actions/workflow changes, including automated dependency bumps.
- `chore:` — everything else that doesn't touch published behavior: repo tooling, Claude Code skills/config,
  dev dependencies, lint/format config, build tooling (tsdown, pnpm catalog), etc.

Repo maintenance and internal restructuring are never `fix:`/`feat:`, even for a large diff — those two are
reserved for changes to a published package's behavior, because `fix:`/`feat:` are what show up in the
changelog and bump the version.

This repo's release notes span every `packages/*` package in one PR (see `release-please-config.json`'s
`packages` map), so scope commits to the affected package's directory name when a change is package-specific
— e.g. `feat(unindent): add indent` — so a reader can tell which package a
changelog line is about.

If a PR merges under the wrong type, correct the entry after the fact with a `BEGIN_COMMIT_OVERRIDE` block in
the merged PR's body, rather than rewriting history.

### PR descriptions

Keep PR descriptions short — no one reads a long one. Prefer bullet points over prose paragraphs; a sentence
packed with more than one or two `inline code` spans is hard to parse — break it into a list instead.

Use `##` headings to break up sections rather than running everything together as prose — one for each part
below that applies.

- `## Summary` — a one- or two-sentence TL;DR that stands on its own: what changed and why, in plain prose.
  It should be readable without anything that follows, not a fragment a later section completes. If the why
  needs more room than that, give it its own sentence or two right after.
- `fix:` and `feat:` PRs are user-facing and feed release notes — write for a reader deciding whether a
  change affects them, not for a reviewer reviewing the diff.
  - For `feat:` PRs, add a `## Feature` heading with a short paragraph on the feature itself: what it lets
    the user do that they couldn't before, and — where it shapes how they should think about using it — why
    it was designed that way.
- `refactor:`/`chore:` PRs are for reviewers, not consumers, so implementation detail belongs here rather
  than being trimmed out — but keep it to the _what_ and _why it matters to a reviewer_, not a mechanical
  _how_ or a narration of the steps taken to get there (e.g. don't mention that something was adapted from
  another repo, or walk through exploration/dead ends). Group by theme (what changed, not which file it
  lives in) — label each group with a short effect/topic phrase, e.g. `**Hidden refactors**`, not a file
  path like `**release-please-config.json**`. A single-item group reads fine as a short paragraph after its
  label; reach for bullets when the group covers several distinct changes, or when one change's rationale
  stacks up more than about two independent facts — that reads as a dense wall however few changes it
  describes. Not `<details>`-gated, since a reviewer needs to see it to review the PR. A `##`/`###` heading
  or a bold label (`**Topic**` on its own line before the paragraph/bullets) both work; use a bold label
  when a full heading would be heavier than the group needs.
- If needed, further detail in `<details>` blocks (e.g. `<summary>Usage</summary>`, `<summary>Details</summary>`),
  as bullet points, not prose paragraphs — these stay collapsed, unlike the `##` headings above, so lead with
  what actually needs a click.
  - For a `feat:`/`fix:` PR, `Usage` should show the changed API with a short code snippet.
- No test plan section — CI covers that.

Do not:

- Restate the diff or narrate file-by-file changes.
- Narrate the process of arriving at the change (where content was copied from, exploration or dead ends,
  which attempt fixed what) — describe the resulting change and why it matters, not the journey there.
- On `fix:`/`feat:` PRs, explain internal implementation, refactors, or code structure the user doesn't
  interact with — that's what `refactor:`/`chore:` PRs are for.
- Add tables, code walkthroughs, or before/after examples for internal behavior.
- Compress the TL;DR into a bare fragment or list of renamed symbols that only makes sense once you've read
  the bullets below it.
- Add auto-generated links back to individual diff hunks or lines (e.g. `[[1]]`/`[[2]]` permalinks) — the
  diff is already there for anyone reviewing.
- Write a separate section per commit or sub-change — one TL;DR covers the whole PR.

</details>
