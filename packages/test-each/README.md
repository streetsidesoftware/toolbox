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
[`util.inspect`](https://nodejs.org/api/util.html#utilinspectobject-options), so strings are quoted: `'empty'`. Use
`$column.key` to reach into an object, as in vitest: `$input.length` or `$a.val`. A missing key gives `undefined`. A
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
