## Usage

Write the template indented to match the code around it. The common indentation is removed, and the lines keep their
indentation relative to each other.

<!--- @@inject: example.ts --->

```ts
import { unindent } from '@streetsidesoftware/unindent';

const HELP = unindent`\
  Usage: tool [options] <file>

  Options:
    -h, --help     Show help.
    -o, --out DIR  Write the result to DIR.
`;

process.stdout.write(HELP);
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=text --->

```text
Usage: tool [options] <file>

Options:
  -h, --help     Show help.
  -o, --out DIR  Write the result to DIR.
```

<!--- @@inject-end: output.md#lang=text --->
