# Releasing

How packages in this repo get versioned and published. Releases run in CI, driven by conventional commits.
Publishing a new package for the first time is done by hand once (see [New packages](#new-packages)).

## How a release happens

1. **Changes collect in a release PR.** `.github/workflows/release-please.yml` keeps a release PR open with every
   package that will be released, its new version, and its changelog. A `feat:` or `fix:` commit marks the packages
   whose files it touches. Nothing is released until the release PR is merged.
2. **Merging the release PR creates the releases.** Each package gets its own GitHub release, tagged
   `<package name>@<version>`, and the root package is tagged `toolbox@<version>`.
3. **The root tag triggers publishing.** `.github/workflows/publish.yml` runs
   `lerna publish from-package --no-private --pre-dist-tag alpha`, which publishes every `packages/*` version that
   isn't on npm yet, through [Trusted Publishing](#trusted-publishing). Private packages are skipped.

## Rules

- **Never edit `release-please-config.json` or `.release-please-manifest.json` by hand.** The
  [Update Release Please Config](https://github.com/streetsidesoftware/toolbox/actions/workflows/update-release-please-config.yml)
  workflow keeps both up to date: when a package is added, removed, renamed or released, it opens a `chore:` PR. Merge it. It runs
  `pnpm run release-please-config`, which:
  - adds a config entry for the root package and every `packages/*` package, private ones included
  - adds each package missing from the manifest at its `package.json` version, and never changes an existing version
  - drops each `release-as` once the manifest shows that version was released
  - drops the entries of packages that no longer exist from the manifest and `static/published.json`, except a
    `false` in `static/published.json`
- **Release state isn't lint.** `pnpm run lint` and `lint-ci` don't touch either file.
  `pnpm run release-please-config:check` reports whether they and `static/published.json` are up to date.
- **Only `packages/*` is released.** Private code lives in `internal/*` and `scripts/`.
- **New packages start private.** A new package has `"private": true`, version `0.0.1-alpha.0`, and
  " -- Private until verified" at the end of its `description`. Leave all three until a maintainer publishes it.

## Release a package at a set version

To release a package at a version you choose, such as `2.0.0` or `3.2.0-alpha.0`, run the
[Set Package Version release-as](https://github.com/streetsidesoftware/toolbox/actions/workflows/release-as.yml)
workflow, or `pnpm run release-as --version <version> <package>`. After the release, merge the PR the Update Release
Please Config workflow opens to remove `release-as`.

## Try changes as alphas

To try risky changes, release a package at a prerelease version, such as `3.2.0-alpha.0` (see
[Release a package at a set version](#release-a-package-at-a-set-version)).

- CI publishes prerelease versions under the npm `alpha` tag, so users who install the package still get `latest`.
- Later releases stay alphas, such as `3.2.1-alpha.0`. To end the alphas, release the latest alpha's version
  without `-alpha`, such as `3.2.1`.

## New packages

A new package starts private and isn't published. Once it's ready, a maintainer with npm publish rights for
`@streetsidesoftware` makes it public.

Trusted Publishing only works for a package that's already on npm. So the maintainer publishes the first version by
hand, as an alpha, and CI publishes every version after it, starting with `1.0.0`.

### 1. Add the package

- Run `pnpm run new-package <name>`, optionally with `--description "<text>"`, then `pnpm install`. It creates
  `packages/<name>/`, named `@streetsidesoftware/<name>`, with `"private": true`, `"version": "0.0.1-alpha.0"`, a
  `description` ending in " -- Private until verified", and a placeholder `src/`, test and `README.md`.
  Here `private` only keeps the package off npm until it's verified. It's still public in this repo and listed in
  the root `README.md` like any other package.
- Keep `files` as `["dist", "!dist/**/*.map"]`, and every published `src/*.ts` entry in both `tsdown.config.ts` and
  `exports`. See [build and packaging](./build-and-packaging.md).
- Fill in the `README.md` for someone installing the package from npm, with absolute `https://` links only.
- The README ends with a `## Support Future Development` section with empty inject markers for
  `../../static/sponsor.md` and `../../static/footer.md`. Leave them empty, and don't run `pnpm run build:readme` in
  the package's PR: it also rewrites the root `README.md` table and `static/packages.csv`, which conflicts with other
  PRs. The Update READMEs workflow fills them in after the merge.
- Run `pnpm run lint`.
- Merge it. The Update Release Please Config workflow then opens a `chore:` PR that adds the package at
  `0.0.1-alpha.0`. Merge that too.

Don't edit `release-please-config.json`, `.release-please-manifest.json` or `static/published.json` in the package's
PR: workflows maintain them.

### 2. The publication PR opens

The
[Prepare a New Package for Publication](https://github.com/streetsidesoftware/toolbox/actions/workflows/prepare-publication.yml)
workflow runs on every push to `main` that changes a `packages/*/package.json`, `release-please-config.json` or
`static/published.json`. A private package waits for publication once it's in `release-please-config.json`, so merging
the Update Release Please Config PR from step 1 opens its PR. For each private package waiting for publication, it
opens a `feat(<dir>): publish to npm` PR that:

- makes the package public (`pnpm run prepare-publication <package>`)
- sets its `release-as` to `1.0.0`
- updates the package's row in the root `README.md` packages table (`pnpm run build:readme`)
- records it in `static/published.json` as waiting for publication: `{ "trustedPublishing": false }`
- lists the commands for steps 3 and 4 as a checklist

It skips a package whose PR is already open, so commits pushed to the PR's branch are kept. To rebuild a stale PR
from `main`, close it and run the workflow by hand. Running it by hand follows the same rules; its `package` input
takes a directory under `packages/` or a package name, and blank means every private package.

#### Publication state

`static/published.json` has one line per package. Only the publication PR and `pnpm exec trusted-publishing` write
it, except for `false`, which a maintainer sets on `main`. When a package is removed or renamed, the Update Release
Please Config PR drops its entry, unless it's `false`.

| Entry                            | Meaning                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| none                             | Not yet prepared. The workflow opens its PR once it's in the config.     |
| `{ "trustedPublishing": false }` | Waiting for publication, or its trusted publisher is missing on npm.     |
| `{ "trustedPublishing": true }`  | Its trusted publisher on npm is `publish.yml`.                           |
| `false`                          | Never publish. The workflow skips it; set it on `main` and close the PR. |

### 3. Publish the first version by hand

Follow the checklist in the PR. It covers:

- checking out only the PR's branch
- logging in to npm with `npm login --auth-type=web`
- building and packing the package, then publishing it with
  `npm publish package.tgz --tag alpha --provenance=false`
- adding the trusted publisher with `pnpm exec trusted-publishing`
- committing `static/published.json`, now `{ "trustedPublishing": true }`, to the PR

Check the files `pnpm pack` lists before publishing: `dist/` is gitignored and must be there.

Publish the alpha, never `1.0.0`. `lerna publish from-package` skips versions already on npm, so a `1.0.0` published
by hand would stay the one version without provenance. The `alpha` tag keeps `latest` unset until CI publishes
`1.0.0`. Use `--provenance=false`, since npm can only create provenance in CI and `publishConfig.provenance` would
otherwise make the publish fail.

### 4. Merge

- Merge the publication PR. The release PR then includes the package at `1.0.0`.
- Merge the release PR. CI publishes `1.0.0` through Trusted Publishing.
- Merge the PR the Update Release Please Config workflow opens to remove `release-as`.

## Trusted Publishing

Every package is published by the [Publish to NPM](https://github.com/streetsidesoftware/toolbox/actions/workflows/publish.yml)
workflow through [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers), with no stored npm token. A
package without a trusted publisher fails to publish. Each package has to name `publish.yml` as its trusted publisher
on npm.

`pnpm run trusted-publishing` manages that. Give it package names, or `--all`. In a package's directory,
`pnpm exec trusted-publishing` works on that package.

- **Add:** `pnpm run trusted-publishing <package>` adds the trusted publisher where it's missing.
- **Check:** `pnpm run trusted-publishing --check <package>` reports whether a package has the trusted publisher, and
  whether its latest version was published through OIDC. Provenance alone doesn't show that: a version published
  with a token has `_npmUser` set to a person instead of `GitHub Actions`.
- **Block tokens:** `pnpm run trusted-publishing --mfa <package>` stops anyone from publishing the package with a
  token.

To run it:

1. Log in with `npm login --auth-type=web`. You need npm 11.15 or later, and publish rights for
   `@streetsidesoftware`.
2. When npm asks for 2FA in the browser, check the box to skip 2FA for the next 5 minutes. If the 5 minutes run out
   before it finishes, run it again: it skips packages that are already set up.
3. Commit `static/published.json`, where the script records each package's `trustedPublishing`.

## Repository secrets

| Secret                   | Used by                                | Purpose                                                     |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------- |
| `AUTOMATION_APP_ID`      | release-please and the PR-opening jobs | GitHub App client ID, so the tags and PRs it creates run CI |
| `AUTOMATION_PRIVATE_KEY` | release-please and the PR-opening jobs | That GitHub App's private key                               |

No npm token is stored: publishing uses Trusted Publishing.

## Fixing a changelog entry after merge

If a PR was merged with the wrong type, correct it on the merged PR. Don't edit the release PR: release-please
rewrites it on every run. Add a block like this to the end of the merged PR's description:

```text
BEGIN_COMMIT_OVERRIDE
chore: corrected commit message
END_COMMIT_OVERRIDE
```

The next time release-please runs, it uses that message instead of the commit's. This only works for squash-merged
PRs.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the commit conventions.
