# Releasing

How packages in this repo get versioned and published. Nothing here is done by hand: conventional commits drive
it.

## The flow

1. **release-please opens a release PR.** `.github/workflows/release-please.yml` bumps versions and changelogs
   from conventional commits, for each package in `release-please-config.json`'s `packages` map. Versions are
   tracked in `.release-please-manifest.json`.
2. **Merging the release PR tags the root package** as `toolbox@x.y.z`, from the `"."` entry. The
   `tag-separator: "@"` and `include-v-in-tag: false` settings give that format.
3. **The tag triggers publishing.** `.github/workflows/publish.yml` runs
   `lerna publish from-package --no-private`, which publishes every `packages/*` package whose version isn't on
   npm yet and skips `private: true` ones.

## Rules

- **Only `packages/*` is published.** Private code lives in `internal/*` and `scripts/`, which lerna never
  looks at.
- **Only publishable packages need a `release-please-config.json` entry**, so their version and changelog are
  tracked.
- **The `"."` entry always stays.** It produces the tag that triggers publishing, even though the root package
  is private and never published.
- **Never hand-edit `release-please-config.json`'s `packages` map.** `fix-release-please-config` regenerates it
  from every `packages/*/package.json`, adding any package whose name doesn't start with `@internal`.
  `pnpm run lint` runs it, and `pnpm run lint-ci` checks it.
- **Never add a package to `.release-please-manifest.json`.** The manifest records each package's last released
  version, and the next release is a bump from it. Seeding a never-released package (at `1.0.0`, say) makes its
  first real release land above `1.0.0`. release-please adds the entry itself on the first release.

## Publishing a new package

### 1. Create the package

- Put it in `packages/<name>/`, named `@streetsidesoftware/<name>`.
- Start from `packages/unindent`: copy its `package.json`, `tsconfig.json`, `tsdown.config.ts` and `LICENSE`.
- Set `"version": "0.0.0"`. release-please replaces it on the first release.
- Keep `files` as `["dist", "!dist/**/*.map"]`, and every published `src/*.ts` entry in both `tsdown.config.ts`
  and `exports`. See [build and packaging](./build-and-packaging.md).
- Write a `README.md` for someone installing the package from npm, with absolute `https://` links only.

### 2. Run `pnpm run lint`

- `fix-package-json` sets `repository` (with `directory`) and `publishConfig` (`access: public`,
  `provenance: true`). Provenance fails without a matching `repository`.
- `fix-release-please-config` adds the package to `release-please-config.json`.
- Commit both changes with the package.

### 3. Merge with a `feat:` commit

- Use a scoped `feat(<name>): ...` commit, so release-please has a user-facing change to release.
- release-please then lists the package in its next release PR at `1.0.0`.

### 4. Check npm access before the release PR merges

- The `PUBLISH_NPM` secret must be an npm token that can publish to the `@streetsidesoftware` scope, including
  new package names under it. A token limited to existing packages fails on a new one.
- npm creates the package on its first publish. No setup on npmjs.com is needed beforehand.

### 5. Merge the release PR

- The `toolbox@x.y.z` tag triggers `publish.yml`, which publishes the new package with provenance.
- Check the package on npmjs.com afterward: the version, the README, and the provenance badge.

## Repository secrets

| Secret                   | Used by              | Purpose                                                              |
| ------------------------ | -------------------- | -------------------------------------------------------------------- |
| `PUBLISH_NPM`            | `publish.yml`        | npm token with publish rights on `@streetsidesoftware`               |
| `AUTOMATION_APP_ID`      | `release-please.yml` | GitHub App client ID, so the release tag can trigger other workflows |
| `AUTOMATION_PRIVATE_KEY` | `release-please.yml` | That GitHub App's private key                                        |

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the commit conventions.
