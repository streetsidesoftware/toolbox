### Plain strings

Call `unindent` on a string too, such as lines copied out of indented code:

<!--- @@inject: example.ts --->

```ts
import { unindent } from '@streetsidesoftware/unindent';

// Lines copied out of an indented function.
const snippet = '    if (ok) {\n      run();\n    }';

console.log(unindent(snippet));
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=text --->

```text
if (ok) {
  run();
}
```

<!--- @@inject-end: output.md#lang=text --->
