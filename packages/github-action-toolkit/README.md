# @streetsidesoftware/github-action-toolkit

A small replacement for [`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core) in the code of
a GitHub Action, with no dependencies.

An action ships with its dependencies bundled in. With `@actions/core`, that means an HTTP client and a command runner
too, about 700 kB, or 400 kB minified, whether the action uses them or not.

This package talks to the runner directly, so an action's bundle holds little more than its own code. It covers the
basics, such as reading inputs, setting outputs, adding to the job summary and failing the step.

For what it doesn't cover, use `@actions/core`.

## Install

```sh
npm install @streetsidesoftware/github-action-toolkit
```

## Usage

An action that counts the files in a directory declares one input and one output in its `action.yaml`:

```yaml
inputs:
  directory:
    description: The directory to look in.
    default: .
outputs:
  count:
    description: The number of files found.
runs:
  using: node24
  main: dist/index.js
```

Its code reads the input, sets the output, and reports what it did:

```ts
import { readdir } from 'node:fs/promises';

import { appendJobSummary, getInput, setFailed, setOutput } from '@streetsidesoftware/github-action-toolkit';

try {
  const directory = getInput('directory');
  const files = await readdir(directory);

  setOutput('count', files.length);
  appendJobSummary(`Found ${files.length} files in \`${directory}\`.\n`);
} catch (error) {
  setFailed(String(error));
}
```

### `getInput(name)`

Read one of the action's inputs. The value comes back without the whitespace around it. An input without a value
gives `''`.

Every input is a string. A workflow that sets `dry-run: true` gives `'true'`:

```ts
const dryRun = getInput('dry-run') === 'true';
```

### `setOutput(name, value)`

Set one of the action's outputs, for later steps to read from `steps.<step id>.outputs.<name>`.

Every output is a string too, so a number or boolean is stored as its text, such as `'3'` or `'true'`. A string can
span several lines.

### `appendJobSummary(markdown)`

Add Markdown to the end of the
[job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary),
which shows on the workflow run's page.

The Markdown goes in as given, right after what the summary already holds, so end it with a newline:

```ts
appendJobSummary('## Updated\n\n');
appendJobSummary('- actions/checkout\n');
```

### `setFailed(message)`

Report an error to the runner and make the step fail. The message shows as an error in the step's log and on the
workflow run's page.

The process keeps running. Its exit code is set to 1, so the step fails when the process ends.

## Outside a workflow run

The functions talk to the GitHub Actions runner through environment variables and files. To run an action's code in a
test or on your own machine, set what it uses:

| Function           | Uses                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `getInput`         | `INPUT_<NAME>`: the input's value. The name is in upper case, with each space as `_`.            |
| `setOutput`        | `GITHUB_OUTPUT`: the path of a file the outputs are added to. Without it, the call throws.       |
| `appendJobSummary` | `GITHUB_STEP_SUMMARY`: the path of a file the Markdown is added to. Without it, the call throws. |
| `setFailed`        | Standard output, where it prints an `::error::` line, and `process.exitCode`.                    |

## Coming from `@actions/core`

Three of the functions have the names they have in
[`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core), with these differences:

- `getInput` takes no options. It always trims the value, and never throws for an input without one.
- `setOutput` takes a string, number or boolean. Convert any other value to a string first, such as with
  `JSON.stringify`.
- `setFailed` takes a string. Convert an `Error` first, such as with `String(error)`.

In place of `summary.addRaw(markdown)` followed by `summary.write()`, call `appendJobSummary(markdown)`.

## Requirements

<!--- @@inject: ../../static/requirements.md#values-file=:package.json --->

Requires Node.js >=22.18.0. ESM only.

<!--- @@inject-end: ../../static/requirements.md#values-file=:package.json --->

## License

<!--- @@inject: ../../static/licenseTpl.md#values-file=:package.json --->

MIT

<!--- @@inject-end: ../../static/licenseTpl.md#values-file=:package.json --->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

If our tools save you time, please consider supporting their development.

Please show your support through one of the following sites:

<p align="left">
  <a href="https://github.com/sponsors/streetsidesoftware" title="GitHub Sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/github-sponsor-dark.png" /><img alt="GitHub Sponsor" src="https://streetsidesoftware.com/img/sponsor/github-sponsor.png" width="180" /></picture></a> &nbsp; <a href="https://www.paypal.com/donate/?hosted_button_id=26LNBP2Q6MKCY" title="PayPal"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/paypal-dark.png" /><img alt="PayPal" src="https://streetsidesoftware.com/img/sponsor/paypal.png" width="180" /></picture></a> &nbsp; <a href="https://opencollective.com/cspell" title="Open Collective"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/open-collective-dark.png" /><img alt="Open Collective" src="https://streetsidesoftware.com/img/sponsor/open-collective.png" width="180" /></picture></a> &nbsp; <a href="https://streetsidesoftware.com/sponsor/" title="Street Side Software"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/cspell-dark.png" /><img alt="CSpell" src="https://streetsidesoftware.com/img/sponsor/cspell.png" width="180" /></picture></a>
</p>

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: ../../static/footer.md --->
