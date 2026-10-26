# toolbox

Tools and libraries used across Street Side Software's repositories.

## Packages

<!--- @@inject: static/packages.csv#markdown --->

| Package                                                             | Description                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`@streetsidesoftware/markdown-toolkit`](packages/markdown-toolkit) | A toolkit for generating Markdown: builders, templates and placeholders.          |
| [`@streetsidesoftware/test-each`](packages/test-each)               | Table-driven tests for node:test, written as vitest-style tagged-template tables. |
| [`@streetsidesoftware/unindent`](packages/unindent)                 | Remove the common indentation from multi-line strings and template literals.      |

<!--- @@inject-end: static/packages.csv#markdown --->

## Development

```sh
pnpm install
pnpm run build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, and [docs/releasing.md](docs/releasing.md) for how
packages are published.

## License

[MIT](LICENSE)
