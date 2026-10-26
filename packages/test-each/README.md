# @streetsidesoftware/test-each

Table-driven tests for [`node:test`](https://nodejs.org/api/test.html), written as tagged-template tables like
vitest's `test.each` and `describe.each`.

## Install

```sh
npm install --save-dev @streetsidesoftware/test-each
```

Requires Node.js 22.18 or later. ESM only.

## Usage

The first line of the table names the columns, separated by `|`. Each line after it is one row, with one `${value}`
per column. `testEach` registers one `test` per row and passes the row to the test function:

```ts
import assert from 'node:assert/strict';

import { testEach } from '@streetsidesoftware/test-each';

testEach`
  a    | b    | sum
  ${1} | ${2} | ${3}
  ${2} | ${3} | ${5}
`('$a + $b', ({ a, b, sum }: { a: number; b: number; sum: number }) => {
  assert.equal(a + b, sum);
});
// ✔ 1 + 2
// ✔ 2 + 3
```

The test function also gets the `node:test` `TestContext` as its second argument.

### `describeEach`

Use `describeEach` to register one `describe` suite per row instead. The suite function gets the row and the
`SuiteContext`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeEach } from '@streetsidesoftware/test-each';

describeEach`
  name       | input
  ${'empty'} | ${''}
  ${'word'}  | ${'hello'}
`('$name', ({ input }: { name: string; input: string }) => {
  test('round-trips', () => {
    assert.equal(JSON.parse(JSON.stringify(input)), input);
  });
});
```

### Titles

A `$column` in the title is replaced by that row's value, formatted with
[`util.inspect`](https://nodejs.org/api/util.html#utilinspectobject-options), so strings are quoted: `'empty'`. A
`$name` that isn't a column is left as it is.

### Errors

A malformed table throws when it's tagged, before any test is registered:

- The first line is empty, has an empty column name (`a || b`), or names a column twice.
- The values don't fill the last row.
- Values in a row aren't separated by `|`, or a row has anything after its last value.

## License

MIT

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<!--- @@inject-end: ../../static/footer.md --->
