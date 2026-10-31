### Trimming the first and last lines

Use `createUnindent` to get an `unindent` that also drops the newline after the opening backtick and the
whitespace-only line before the closing one. A shell script needs this, since its `#!` line must come first:

<!--- @@inject: example.ts --->

```ts
import {
  createUnindent,
  unindent,
} from '@streetsidesoftware/unindent';

const trimmed = createUnindent({
  trimFirstNewline: true,
  trimLastLine: true,
});

const kept = unindent`
  #!/bin/sh
  echo "Hello"
`;

const script = trimmed`
  #!/bin/sh
  echo "Hello"
`;

console.log(JSON.stringify(kept));
console.log(JSON.stringify(script));
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=text --->

```text
"\n#!/bin/sh\necho \"Hello\"\n"
"#!/bin/sh\necho \"Hello\""
```

<!--- @@inject-end: output.md#lang=text --->

| Option             | Default | Effect                                                                      |
| ------------------ | ------- | --------------------------------------------------------------------------- |
| `trimFirstNewline` | `false` | Drop one leading newline.                                                   |
| `trimLastLine`     | `false` | Drop the last line, with the newline before it, when it is whitespace-only. |
