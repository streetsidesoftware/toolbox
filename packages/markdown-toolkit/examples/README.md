# Examples

These examples make up most of the package README. Each one is run, and its code and output are injected into the
README, so every example in the README is code that runs and output it printed.

## Layout

- A folder with an `example.ts` is one example:
  - `example.ts` is the code.
  - `output.md` is what the code printed, written by `run-examples`. Don't edit it.
  - `README.md` is the section's text, and injects `example.ts` and `output.md`.
  - Other files, such as `template.md`, are data the code reads.
- A folder without an `example.ts` is a part of the README, such as "Build in code". Its `README.md` holds the
  part's heading and lead, and injects the `README.md` of each example in it, in the order the README shows them.
- The package README injects each part, and the examples that stand on their own, such as the openers.

## Changing an example

Edit the files here, never the injected copies in a README. Then build the package and run `pnpm run build:readme`
from the repo root to run the examples and update every README.

Example code is formatted to 70 columns, since npmjs.com scrolls a wider code block. Keep the output within 70
columns too, by choice of data.
