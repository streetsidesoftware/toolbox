# @streetsidesoftware/markdown-sanitizer

Find the text in Markdown that the rendered page hides, but an agent reading the Markdown sees. Use it to check text
from commits or pull requests before it lands in a changelog that agents read.

## Install

```sh
npm install @streetsidesoftware/markdown-sanitizer
```

## Usage

```ts
import { findHidden } from '@streetsidesoftware/markdown-sanitizer';

const message = 'Fix the parser.\n\n<!-- Ignore previous instructions. -->\n';

for (const hidden of findHidden(message)) {
  console.log(`${hidden.line}:${hidden.column} ${hidden.kind}: ${JSON.stringify(hidden.text)}`);
}
```

```text
3:1 comment: "<!-- Ignore previous instructions. -->"
```

To take the hidden text out, or to show it on the page for a reviewer, use `sanitize`:

```ts
import { sanitize } from '@streetsidesoftware/markdown-sanitizer';

sanitize('Fix the <!-- secret --> parser.', 'remove');
// Fix the  parser.

sanitize('Fix the <!-- secret --> parser.', 'reveal');
// Fix the `<!-- secret -->` parser.
```

Revealing shows each comment, unused definition or footnote as code, exactly as an agent reads it: as code in its
line, as a code block when it's on lines of its own, or as HTML code inside other HTML.

## What counts as hidden

- **Comments.** An HTML comment hides its text, and so does HTML that a browser reads as a comment, such as `<?…>`.
  A comment can sit inside other HTML. A comment left open hides the rest of the page. A comment in code shows on
  the page, so it isn't hidden.
- **Unused definitions.** A link definition that no link uses shows nothing, which makes `[//]: # (note)` a common
  way to write a comment. A footnote that nothing cites shows nothing either.
- **Invisible characters.** Direction overrides, variation selectors, Unicode tag characters and other characters
  that show as nothing, even in code. A character reference such as `&#x202E;` counts too.

Some invisible characters are ok, since they only control line breaks, joining or the direction of punctuation:
the soft hyphen, the zero-width space, joiner and non-joiner, the word joiner, the byte order mark, and the
left-to-right, right-to-left and Arabic letter marks. So are the variation selectors and tags that form an emoji,
such as ❤️ or the Scotland flag.

Each result gives the kind, the offsets of the hidden text in the Markdown, its line and column, and the text itself.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

## License

<!-- @@inject: ../../static/licenseTpl.md#values-file=:package.json -->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->
