### Multi-line comments

When the text of a `comment` has a line ending, its markers go on lines of their own. It can't go inside a line, so in a paragraph or a summary it throws. Nothing is trimmed, and blank lines stay.

<details>
<summary>Example</summary>

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.comment('cspell:ignore ssjcs\ncspell:words StreetSideSoftware'),
  md.p('Maintained by Street Side Software.'),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
<!--
cspell:ignore ssjcs
cspell:words StreetSideSoftware
-->

Maintained by Street Side Software.
```

<!--- @@inject-end: output.md --->

</details>

For a fixed form, use one of these:

- `blockComment` always puts its markers on lines of their own.
- `inlineComment` stays on one line, and its text can't have a line ending.

A placeholder's value goes in as given and doesn't change the form, so use `blockComment` for a value with several lines.
