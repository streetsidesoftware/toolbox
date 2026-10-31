### Multi-line values

When a value inserted with `${}` spans several lines, each line after the first gets the leading whitespace of the
template line it is inserted on. The value keeps its shape in the result:

<!--- @@inject: example.ts --->

```ts
import { unindent } from '@streetsidesoftware/unindent';

const steps = ['pnpm install', 'pnpm test'].join('\n');

const workflow = unindent`\
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - run: |
            ${steps}
`;

process.stdout.write(workflow);
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=yaml --->

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pnpm install
          pnpm test
```

<!--- @@inject-end: output.md#lang=yaml --->

The padding is the template line's leading whitespace, tabs included, not the column of the `${}`. An empty line in the
value stays empty, and the rest of the value is kept as given: its own indentation, a trailing newline and its line
endings.
