### `indent`

Use `indent` to add padding to every line of a string except the first, such as a multi-line entry in a list. An empty
line stays empty. An optional third argument pads the first line:

<!--- @@inject: example.ts --->

```ts
import { indent } from '@streetsidesoftware/unindent';

const changes = [
  'Fix a crash on empty input.\nIt now returns an empty string.',
  'Add `indent`.',
];

const items = changes.map((change) => indent(change, '  ', '- '));

console.log(items.join('\n'));
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md#lang=markdown --->

```markdown
- Fix a crash on empty input.
  It now returns an empty string.
- Add `indent`.
```

<!--- @@inject-end: output.md#lang=markdown --->
