# Examples

These examples make up most of the package README. Each one is run, and its code and output are injected into the
README, so every example in the README is code that runs and output it printed.

## Layout

- A folder with an `example.ts` is one example:
  - `example.ts` is the code.
  - `output.md` is what the code printed, written by `run-examples`. Don't edit it.
  - `README.md` is the section's text, and injects `example.ts` and `output.md`.
- The package README injects each example's `README.md`.

## Changing an example

Edit the files here, never the injected copies in a README. Then build the package and run `pnpm run build:readme`
from the repo root to run the examples and update every README.

Example code is formatted to 70 columns, since npmjs.com scrolls a wider code block. Keep the output within 70
columns too, by choice of data.
