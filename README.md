# toolbox

Tools and libraries used across Street Side Software's repositories.

## Packages

<!--- @@inject: static/packages.csv#markdown --->

| Package                                                                       | Description                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`@streetsidesoftware/copy-github-files`](packages/copy-github-files)         | Copy files from a GitHub repository into local files.                                                               |
| [`@streetsidesoftware/github-action-toolkit`](packages/github-action-toolkit) | A small replacement for @actions/core in the code of a GitHub Action, with no dependencies.                         |
| [`@streetsidesoftware/markdown-sanitizer`](packages/markdown-sanitizer)       | Find Markdown text that the page hides but agents read, and remove it or make it visible. -- Private until verified |
| [`@streetsidesoftware/markdown-toolkit`](packages/markdown-toolkit)           | A toolkit for generating Markdown: builders, templates and placeholders.                                            |
| [`@streetsidesoftware/placeholders`](packages/placeholders)                   | Replace placeholders in a string.                                                                                   |
| [`@streetsidesoftware/test-each`](packages/test-each)                         | Table-driven tests for node:test, written as vitest-style tagged-template tables.                                   |
| [`@streetsidesoftware/unindent`](packages/unindent)                           | Remove the common indentation from multi-line strings and template literals.                                        |

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
