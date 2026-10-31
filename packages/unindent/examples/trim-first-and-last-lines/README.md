### Trimming the first and last lines

Use `createUnindent` to get an `unindent` that also drops the newline after the opening backtick and the
whitespace-only line before the closing one. An error message needs both, so it has no blank line before or after it:

<!--- @@inject: example.ts --->

```ts
import {
  createUnindent,
  unindent,
} from '@streetsidesoftware/unindent';

const trimmedUnindent = createUnindent({
  trimFirstNewline: true,
  trimLastLine: true,
});

const untrimmed = unindent`
  Could not read config.json.
  Run tool init to create one.
`;

const trimmed = trimmedUnindent`
  Could not read config.json.
  Run tool init to create one.
`;

console.log(JSON.stringify(untrimmed));
console.log(JSON.stringify(trimmed));
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=text --->

```text
"\nCould not read config.json.\nRun tool init to create one.\n"
"Could not read config.json.\nRun tool init to create one."
```

<!--- @@inject-end: output.md#lang=text --->

| Option             | Default | Effect                                                                      |
| ------------------ | ------- | --------------------------------------------------------------------------- |
| `trimFirstNewline` | `false` | Drop one leading newline.                                                   |
| `trimLastLine`     | `false` | Drop the last line, with the newline before it, when it is whitespace-only. |
