### Line breaks and comments

A newline in a string, or a `lineBreak()`, starts a new line in the same paragraph. For HTML or MDX, `br()` always writes `<br/>`. A
`comment` is an HTML comment, which isn't displayed, such as a `cspell:ignore` line for a spell checker.

<!--- @@inject: example.ts --->

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.comment('cspell:ignore gezellig'),
  md.p('Knows Dutch words such as ', md.emphasis('gezellig'), '.'),
  md.p('Maintained by', md.lineBreak(), 'Street Side Software'),
);

console.log(page.toString());
```

<!--- @@inject-end: example.ts --->

<!--- @@inject-code: output.md --->

```markdown
<!-- cspell:ignore gezellig -->

Knows Dutch words such as _gezellig_.

Maintained by\
Street Side Software
```

<!--- @@inject-end: output.md --->
