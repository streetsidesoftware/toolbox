# Build and packaging

How the packages in this repo are built, tested, and packaged for npm.

## Workspace layout

- **`packages/*`**: packages published to npm as `@streetsidesoftware/<name>`. A new one starts `private: true`
  until a maintainer publishes it (see [releasing](./releasing.md#new-packages)); nothing else private goes here.
- **`internal/*`**: private packages used only inside this repo, named `@internal/<name>` with
  `"private": true`. They are never published or bundled into a published package.
- **`scripts/`**: the `@internal/scripts` package with the repo maintenance CLIs. See
  [`scripts/README.md`](../scripts/README.md).

## Toolchain

- **tsdown builds each package's `dist/`.** Every option except `entry` lives once in
  `.config/tsdown.config.ts`. Each package's `tsdown.config.ts` is just `mergeConfig(base, { entry: [...] })`.
  Put new shared build options in the base, not in a package.
- **TypeScript only type-checks** (`tsc --noEmit`). It never emits.
- **No project references.** `tsconfig.base.json` sets `noEmit: true`, and each package has its own flat
  `tsconfig.json` extending it. There's intentionally no root `tsconfig.json`.
- **Node's built-in test runner runs the tests.** Each package's `test` script is
  `node --test "src/**/*.test.ts"`, with `node:test` and `node:assert/strict`. Node runs the `.ts` files directly
  by stripping types, so there's no test build step and no test framework dependency.
- **Only erasable TypeScript.** Because Node strips types rather than compiling them, `tsconfig.base.json` sets
  `erasableSyntaxOnly` and `verbatimModuleSyntax`: no `enum`, no `namespace`, no parameter properties, and type
  imports use `import type`.
- **Exports need explicit types.** `tsconfig.base.json` sets `isolatedDeclarations`, so tsdown generates each
  `.d.ts` with Oxc instead of the TypeScript API. An exported function or value needs an explicit type unless
  it can be read straight from the code, such as a literal. `scripts/` turns it off, since nothing there is
  built.
- **Tools are root dev dependencies.** `tsdown`, `typescript` and `shx` are declared once at the root and
  resolve into packages through Node's ancestor `node_modules` lookup, which works even with
  `nodeLinker: isolated`.
- **Nothing from `node_modules` is bundled.** By default, tsdown copies a dev dependency's code or types into
  `dist/` when a package imports it, such as `@types/mdast` reached from a public type. The shared config sets
  `deps: { onlyBundle: [] }`, so the build fails instead. A package's public types use only its production
  dependencies, or its own copy of a third-party type, checked with `satisfies` in a test.
- **Relative imports use `.ts` extensions**, as in `from './unindent.ts'`. tsdown rewrites them to `.js`.

## Entry points

- **Two lists, kept in step by hand.** Every published `src/*.ts` file needs both an entry in
  `tsdown.config.ts`'s `entry` and a subpath in `package.json`'s `exports`. tsdown doesn't infer one from the
  other. A file missing from `entry` builds without error and leaves its subpath broken.
- **ESM only, plain extensions.** Build output is `dist/*.js` and `dist/*.d.ts`, one pair per entry. This needs
  `fixedExtension: false` in the shared config.

## What gets published

- **`files` is `["dist", "!dist/**/*.map"]`.** Without it, npm ships everything not gitignored. npm always
  includes `package.json`, `README.md`, and `LICENSE`.
- **Source maps stay local.** The shared config sets `sourcemap: true` for debugging from a checkout, and
  `files` keeps the maps out of the tarball.
- **Each package has its own `LICENSE`**, a copy of the root one, since npm only bundles a `LICENSE` inside the
  package. `fix-package-json` copies the root one in, so edit only the root `LICENSE`.
- **Keep production dependencies few.** Be conservative about adding a `dependencies` entry, and check its
  license first by [dependency licenses](./dependency-licenses.md).
- **`fix-package-json` sets the rest.** `pnpm run lint` runs it on `packages/*`, `internal/*` and `scripts/`:
  - `repository`, with `directory` pointing at the package. npm's provenance check needs `repository.url` to
    match the repo the build ran in.
  - `publishConfig`: public access with provenance, or restricted for `@internal/*`.
  - `engines.node`, copied from the root `package.json`. Change the Node.js version there and run
    `pnpm run lint`; `lint-ci` fails while a package is out of step. `new-package` sets it the same way, so the
    template in `static/templates/` has none.
  - Sorted, deduped `keywords`, and the order of the fields.

For releasing, see [releasing](./releasing.md).
