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
line, as a code block when it's on lines of its own, or as HTML code inside other HTML. Each tag character or
variation selector shows as an escape, such as `\u{E0041}`, so a model doesn't read the text it spells.

Revealed text is for a reviewer. An agent reads it too, so remove hidden text from Markdown that agents read, such
as a changelog.

Removing hidden text can join the text around it into new hidden text, such as a new comment, so removal repeats until
nothing is hidden. Markdown that still hides text after 100 passes of removal isn't allowed.

## What counts as hidden

- **Comments.** An HTML comment hides its text, and so does HTML that a browser reads as a comment, such as `<?…>`.
  A comment can sit inside other HTML. A comment left open hides the rest of the page. A comment in code shows on
  the page, so it isn't hidden.
- **Unused definitions.** A link definition that no link uses shows nothing, which makes `[//]: # (note)` a common
  way to write a comment. A footnote that nothing cites shows nothing either.
- **Tag characters and variation selectors.** The page shows nothing for them, even in code, but a model reads tag
  characters as text, and a run of variation selectors can steer it. A character reference such as `&#xE0041;`
  counts too. The ones that form an emoji, such as ❤️ or the Scotland flag, aren't hidden text.

Other invisible characters, such as the zero-width space, the soft hyphen or a direction mark, carry nothing an agent
acts on, so they aren't hidden text.

Each result gives the kind, the offsets of the hidden text in the Markdown, its line and column, and the text itself.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

## License

<!-- @@inject: ../../static/licenseTpl.md#values-file=:package.json -->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->
